---
title: Syzkaller V - syz-executor
date: 2024-12-21 21:09:00
tags: syzkaller
mathjax: true
---
# [Syzkaller V]syz-executor

`syz-executor` 是 syzkaller 中运行在目标虚拟机（Target VM）内部的 C++ 程序，负责实际执行模糊测试生成的系统调用序列。

![syzkaller_arch](https://raw.githubusercontent.com/DeutschBall/picbed/main/202604050106846.png)

executor的编译命令:

```makefile
	mkdir -p ./bin/$(TARGETOS)_$(TARGETARCH)
	$(CXX) -o ./bin/$(TARGETOS)_$(TARGETARCH)/syz-executor$(EXE) executor/executor.cc \
		$(ADDCXXFLAGS) $(CXXFLAGS) $(LDFLAGS) -DGOOS_$(TARGETOS)=1 -DGOARCH_$(TARGETARCH)=1 \
		-DHOSTGOOS_$(HOSTOS)=1 -DGIT_REVISION=\"$(REV)\"
```

这里的环境变量CXX、ADDCXXFLAGS、CXXFLAGS、LDFLAGS等等， 在makefile中并没有定义，并且在构建syzkaller项目时，也只需要make就可以了，也没有在命令行上显式指定这几个环境变量， 那么这几个环境变量从哪来的呢？

在Makefile文件的62~66行这样写到

```makefile
ENV := $(subst \n,$(newline),$(shell CI=$(CI)\
	SOURCEDIR=$(SOURCEDIR) HOSTOS=$(HOSTOS) HOSTARCH=$(HOSTARCH) \
	TARGETOS=$(TARGETOS) TARGETARCH=$(TARGETARCH) TARGETVMARCH=$(TARGETVMARCH) \
	SYZ_CLANG=$(SYZ_CLANG) \
	go run $(GOHOSTFLAGS) tools/syz-make/make.go))
```

也就是说这几个环境变量是执行了syz-make程序， 该程序会判断当前架构与平台，因地制宜地决定编译和链接选项

经过调试，在我的kali-linux wsl上，syz-make会设置如下环境变量

```js
{Name: "BUILDOS", Val: "linux"},
{Name: "NATIVEBUILDOS", Val: "linux"},
{Name: "HOSTOS", Val: "linux"},
{Name: "HOSTARCH", Val: "amd64"},
{Name: "TARGETOS", Val: "linux"},
{Name: "TARGETARCH", Val: "amd64"},
{Name: "TARGETVMARCH", Val: "amd64"},
{Name: "CC", Val: "gcc"},
{Name: "CXX", Val: "g++"},
{Name: "ADDCFLAGS", Val: "-m64 -O2 -pthread -Wall -Werror -Wparentheses -Wunused-const-variable -Wframe-larger-than=16384 -Wno-stringop-overflow -Wno-array-bounds -Wno-format-overflow -Wno-unused-but-set-variable -Wno-unused-command-line-argument -static-pie"},
{Name: "ADDCXXFLAGS", Val: "-m64 -O2 -pthread -Wall -Werror -Wparentheses -Wunused-const-variable -Wframe-larger-than=16384 -Wno-stringop-overflow -Wno-array-bounds -Wno-format-overflow -Wno-unused-but-set-variable -Wno-unused-command-line-argument -static-pie -std=c++17 -I. -Iexecutor/_include"},
{Name: "NCORES", Val: "2"},
{Name: "EXE", Val: ""},
{Name: "NATIVEBUILDOS", Val: "linux"},
{Name: "NO_CROSS_COMPILER", Val: ""}
```

需要注意的是，`ADDCXXFLAGS`这里的编译选项

| 编译选项                          | 意义                                      |
| --------------------------------- | ----------------------------------------- |
| -m64                              | 编译成64位binary                          |
| -O2                               | O2优化等级                                |
| -pthread                          | 链接pthread库，可能是有多线程需求         |
| -Wall                             | 开启所有警告                              |
| -Werror                           | 所有警告视为错误                          |
| -Wparentheses                     | 警告if的条件判断中==可能写成了=           |
| -Wunused-const-variable           | 着重警告定义但没使用的常量                |
| -Wframe-larger-than=16384         | 每个函数栈帧不允许超过16384Bytes          |
| -Wno-stringop-overflow            | 关闭可能的字符串操作溢出警告              |
| -Wno-array-bounds                 | 关闭可能的数组越界访问警告                |
| -Wno-format-overflow              | 关闭可能的格式化字符串溢出警告            |
| -Wno-unused-but-set-variable      | 关闭变量赋值但未使用警告                  |
| -Wno-unused-command-line-argument | 关闭未使用的命令行参数警告                |
| -static-pie                       | 静态链接， 位置无关执行                   |
| -std=c++17                        | c++17标准                                 |
| -I.                               | 当前目录添加到头文件搜索范围              |
| -Iexecutor/_include               | executor/_include目录添加到头文件搜索范围 |

因此syz-executor是静态链接的，可以在虚拟机中独立执行的

```sh
┌──(root㉿DustReich)-[/usr/src/syzkaller/bin/linux_amd64]
└─# file syz-executor
syz-executor: ELF 64-bit LSB pie executable, x86-64, version 1 (GNU/Linux), static-pie linked, BuildID[sha1]=345d44ae71e26654778ef5f35ea1b8efc6edf1a6, for GNU/Linux 3.2.0, not stripped
```

![image-20260105214403031](https://raw.githubusercontent.com/DeutschBall/VideoBed/main/202601052144692.png)

syz-executor runner 0 localhost 51589
