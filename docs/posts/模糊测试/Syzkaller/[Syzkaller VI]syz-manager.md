---
title: Syzkaller VI - syz-manager
date: 2024-12-21 21:09:00
# tags:
#   - syzkaller
mathjax: true
---
# [Syzkaller VI]syz-manager

1. 加载配置文件
2. 建立HTTP服务器, 实时报告进度
3. 建立rpc服务器, 等待fuzzer连接
4. 执行ssh命令, 登录到虚拟机上执行syz-executor

```sh
"cd / && /syz-executor runner 0 localhost 51589"
```

```c
./bin/syz-manager -config=./config.txt
```

配置文件示例

```json
{
        "target": "linux/amd64",
        "http": "127.0.0.1:56741",
        "workdir": "/usr/src/syzkaller/workdir",
        "kernel_obj": "/usr/src/linux/linux-5.13/",
        "image": "/home/dustball/image/bullseye.img",
        "sshkey": "/home/dustball/image/bullseye.id_rsa",
        "syzkaller": "/usr/src/syzkaller/",
        "procs": 8,
        "type": "qemu",
        "sandbox": "setuid",
        "enable_syscalls":[
                        "open$testxy",
                        "read$testxy",
                        "write$testxy"
        ],
        "vm": {
                "count": 1,
                "kernel": "/usr/src/linux/linux-5.13/arch/x86/boot/bzImage",
                "cpu": 2,
                "mem": 2048 ,
                "cmdline": "net.ifnames=0"
        }
}
```

sshArgs

"/syz-executor runner 0 localhost 51589"

![image-20251215213300417](https://raw.githubusercontent.com/DeutschBall/VideoBed/main/202512152133614.png)

```
[]string len: 32, cap: 32, ["qemu-system-x86_64","-m","2048","-smp","2","-chardev","socket,id=SOCKSYZ,server=on,wait=off,host=localhost,port=53276","-mon","chardev=SOCKSYZ,mode=control","-display","none","-serial","stdio","-no-reboot","-name","VM-0","-device","virtio-rng-pci","-enable-kvm","-cpu","host,migratable=off","-device","e1000,netdev=net0","-netdev","user,id=net0,restrict=on,hostfwd=tcp:127.0.0.1:50885-:22","-hda","/home/dustball/image/bullseye.img","-snapshot","-kernel","/usr/src/linux/linux-5.13/arch/x86/boot/bzImage","-append","root=/dev/sda console=ttyS0 net.ifnames=0"]
```

## 控制流分析

### main

主要干了三件事:

1. 解析命令行参数
2. 加载配置文件
3. RunManager

```go
func main() {
	flag.Parse()

	cfg, err := mgrconfig.LoadFile(*flagConfig)

	RunManager(mode, cfg)
}
```

### Runmanager

```go
func RunManager(mode *Mode, cfg *mgrconfig.Config) {
	var vmPool *vm.Pool
	if !cfg.VMLess {
		var err error
		vmPool, err = vm.Create(cfg, *flagDebug)
		if err != nil {
			log.Fatalf("%v", err)
		}
		defer vmPool.Close()
	}

	osutil.MkdirAll(cfg.Workdir)

	reporter, err := report.NewReporter(cfg)

	mgr := &Manager{
		cfg:                cfg,
		mode:               mode,
		vmPool:             vmPool,
		corpusPreload:      make(chan []fuzzer.Candidate),
		target:             cfg.Target,
		sysTarget:          cfg.SysTarget,
		reporter:           reporter,
		crashStore:         manager.NewCrashStore(cfg),
		crashTypes:         make(map[string]bool),
		disabledHashes:     make(map[string]struct{}),
		memoryLeakFrames:   make(map[string]bool),
		dataRaceFrames:     make(map[string]bool),
		fresh:              true,
		externalReproQueue: make(chan *manager.Crash, 10),
		crashes:            make(chan *manager.Crash, 10),
		saturatedCalls:     make(map[string]bool),
		reportGenerator:    manager.ReportGeneratorCache(cfg),
	}

	mgr.http = &manager.HTTPServer{
		// Note that if cfg.HTTP == "", we don't start the server.
		Cfg:        cfg,
		StartTime:  time.Now(),
		CrashStore: mgr.crashStore,
	}

	mgr.initStats()
	if mgr.mode.LoadCorpus {
		go mgr.preloadCorpus()
	} else {
		close(mgr.corpusPreload)
	}

	// Create RPC server for fuzzers.
	mgr.servStats = rpcserver.NewStats()
	rpcCfg := &rpcserver.RemoteConfig{
		Config:  mgr.cfg,
		Manager: mgr,
		Stats:   mgr.servStats,
		Debug:   *flagDebug,
	}
	mgr.serv, err = rpcserver.New(rpcCfg)

  
	ctx := vm.ShutdownCtx()
	go func() {
		err := mgr.serv.Serve(ctx)
		if err != nil {
			log.Fatalf("%s", err)
		}
	}()
	log.Logf(0, "serving rpc on tcp://%v", mgr.serv.Port())

	if cfg.DashboardAddr != "" {
		opts := []dashapi.DashboardOpts{}
		if cfg.DashboardUserAgent != "" {
			opts = append(opts, dashapi.UserAgent(cfg.DashboardUserAgent))
		}
		dash, err := dashapi.New(cfg.DashboardClient, cfg.DashboardAddr, cfg.DashboardKey, opts...)
		if err != nil {
			log.Fatalf("failed to create dashapi connection: %v", err)
		}
		mgr.dashRepro = dash
		if !cfg.DashboardOnlyRepro {
			mgr.dash = dash
		}
	}

	if !cfg.AssetStorage.IsEmpty() {
		mgr.assetStorage, err = asset.StorageFromConfig(cfg.AssetStorage, mgr.dash)
		if err != nil {
			log.Fatalf("failed to init asset storage: %v", err)
		}
	}

	if *flagBench != "" {
		mgr.initBench()
	}

	go mgr.heartbeatLoop()
	if mgr.mode != ModeSmokeTest {
		osutil.HandleInterrupts(vm.Shutdown)
	}

	mgr.pool = vm.NewDispatcher(mgr.vmPool, mgr.fuzzerInstance)
	mgr.http.Pool = mgr.pool
	reproVMs := max(0, mgr.vmPool.Count()-mgr.cfg.FuzzingVMs)
	mgr.reproLoop = manager.NewReproLoop(mgr, reproVMs, mgr.cfg.DashboardOnlyRepro)
	mgr.http.ReproLoop = mgr.reproLoop
	mgr.http.TogglePause = mgr.pool.TogglePause

	if mgr.cfg.HTTP != "" {
		go func() {
			err := mgr.http.Serve(ctx)
			if err != nil {
				log.Fatalf("failed to serve HTTP: %v", err)
			}
		}()
	}
	go mgr.trackUsedFiles()
	go mgr.processFuzzingResults(ctx)
	mgr.pool.Loop(ctx)
}

```

```go
//manager.go
	var vmPool *vm.Pool
	if !cfg.VMLess {
		var err error
		vmPool, err = vm.Create(cfg, *flagDebug)	//调用vm模块下的Create函数
		if err != nil {
			log.Fatalf("%v", err)
		}
		defer vmPool.Close()
	}
```

```go
// vm/vm.go
// Create creates a VM pool that can be used to create individual VMs.
func Create(cfg *mgrconfig.Config, debug bool) (*Pool, error) {
	typ, ok := vmimpl.Types[vmType(cfg.Type)]
    //每个vm目录下的虚拟机类型, 比如qemu, 都会调用vmimpl.Register往这个列表中注册类型, 以及该类型的构造函数ctor
	if !ok {
		return nil, fmt.Errorf("unknown instance type '%v'", cfg.Type)
	}
	env := &vmimpl.Env{
		Name:      cfg.Name,
		OS:        cfg.TargetOS,
		Arch:      cfg.TargetVMArch,
		Workdir:   cfg.Workdir,
		Image:     cfg.Image,
		SSHKey:    cfg.SSHKey,
		SSHUser:   cfg.SSHUser,
		Timeouts:  cfg.Timeouts,
		Snapshot:  cfg.Snapshot,
		Debug:     debug,
		Config:    cfg.VM,
		KernelSrc: cfg.KernelSrc,
	}
	impl, err := typ.Ctor(env)
	if err != nil {
		return nil, err
	}
	count := impl.Count()
	if debug && count > 1 {
		log.Logf(0, "limiting number of VMs from %v to 1 in debug mode", count)
		count = 1
	}
	return &Pool{
		impl:       impl,
		typ:        typ,
		workdir:    env.Workdir,
		template:   cfg.WorkdirTemplate,
		timeouts:   cfg.Timeouts,
		count:      count,
		snapshot:   cfg.Snapshot,
		hostFuzzer: cfg.SysTarget.HostFuzzer,
		statOutputReceived: stat.New("vm output", "Bytes of VM console output received",
			stat.Graph("traffic"), stat.Rate{}, stat.FormatMB),
	}, nil
}

```

创建vm pool,

vm, virtual machine, 虚拟机

根据 `cfg`中的 `"type": "qemu"`键值对, 决定创建何种类型的 `vm`

```go
type Pool struct {
	impl               vmimpl.Pool
	typ                vmimpl.Type
	workdir            string
	template           string
	timeouts           targets.Timeouts
	count              int
	activeCount        int32
	snapshot           bool
	hostFuzzer         bool
	statOutputReceived *stat.Val
}

// Pool represents a set of test machines (VMs, physical devices, etc) of particular type.
type Pool interface {
	// Count returns total number of VMs in the pool.
	Count() int

	// Create creates and boots a new VM instance.
	Create(ctx context.Context, workdir string, index int) (Instance, error)
}

```

加载corpus,

位置为config文件中指定的workdir路径后缀加上/corpus.db, 比如: "/usr/src/syzkaller/workdir/corpus.db"

使用bufio.NewReader读取成字节流, 然后反序列化

这个corpus的格式为:

![image-20251217215620079](https://raw.githubusercontent.com/DeutschBall/VideoBed/main/202512172156253.png)
