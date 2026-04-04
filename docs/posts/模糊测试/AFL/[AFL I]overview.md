---
title: AFL I - overview
date: 2025-04-22 13:14:00
tags: 模糊测试
mathjax: true








---





# [AFL I] overview

使用AFL进行模糊测试的流程:

1.使用afl-gcc代替gcc编译目标程序

2.指定初始的输入语料文件, 开始fuzz







## 编译时插桩技术

![image-20250210133521674](https://raw.githubusercontent.com/DeutschBall/VideoBed/main/image-20250210133521674.png)

```sh
gcc main.c
    -B /usr/src/AFL
    -no-integrated-as AFL_HARDEN
    -fstack-protector-all
    -D_FORTIFY_SOURCE=2 AFL_USE_ASAN AFL_USE_MSAN
    -U_FORTIFY_SOURCE AFL_DONT_OPTIMIZE
    -g
    -O3
    -funroll-loops
    -D__AFL_COMPILER=1 AFL_NO_BUILTIN
    -fno-builtin-strcmp
    -fno-builtin-strncmp
    -fno-builtin-strcasecmp
    -fno-builtin-strncasecmp
    -fno-builtin-memcmp
    -fno-builtin-strstr
    -fno-builtin-strcasestr
```





### 插桩的作用?

将汇编代码以**标号**划分成块

work函数在汇编层面有work,L2,L3三个标号,那么就划分为对应的三块

将代码块作为节点, 以跳转方向为边就构建了一张有向图



块的性质如下:

1.块内不允许有任何“跳转指令”,包括跳转jmp,和各种条件跳转如jz,jle等

2.块内可以有函数调用以及返回指令,函数调用视为节点内的子图

3.在每个块的最开始加入AFL TRAMPOLINE, 用于记录该块的访问状态,由于块内不含有跳转指令,那么当蹦床被调用时,就意味着整块都被访问到了

**那么覆盖率问题就变成了有向图节点的可达性统计**

这个蹦床的作用就是:当其所在节点被执行到时通知覆盖率统计器

![image-20250210170146007](https://raw.githubusercontent.com/DeutschBall/VideoBed/main/image-20250210170146007.png)



### 蹦床什么样?

> 蹦床指一段格式固定,发挥中介作用帮助程序实现控制流跳跃的某段代码或者某个函数
>
> 比如系统调用从内核态返回到用户态时走trampoline函数回复用户态上下文



![image-20250210164937725](https://raw.githubusercontent.com/DeutschBall/VideoBed/main/image-20250210164937725.png)

在进入标号的一开始加入蹦床,原代码块保持不变

蹦床上干了这几件事:

1.保护现场

2.以`rcx`传递参数`0xb3a7`

3.调用`__afl_maybe_log`函数

4.恢复现场

这里每个代码块的蹦床上,rcx传递的参数值不同,可以理解为一个代码块的指纹

比如work块的指纹 就是0x6769, L2块的指纹就是0xea58等



除去在每个代码块开头加上的蹦床外，在汇编代码最后又加上了AFL mainpayload

其中就包含了蹦床中调用到的`__afl_maybe_log`函数





### 蹦床怎样加上的?

首先明确afl-as的输入输出

```
插桩前汇编代码main.s => afl-as插桩 => 插桩后汇编代码
```

这个过程是现在`add_instrumentation@afl-as.c`函数中,

这个函数可以视为一个硬编码的解释器,只用了`245`行,就集成了词法分析,语法分析,语义分析的功能.

各种语法分析的目的，就是在`main.s`中找到每个代码块儿入口位置，并插桩







### 共享内存的作用?

蹦床实际上调用了`__afl_maybe_log($rcx)`

该函数会首先初始化共享内存,然后根据rcx记录相应的访问路径

```asm
__afl_maybe_log:
							;保存现场
  lahf						;将eflags低8位保存到ah
  seto  %al					;将of标志位保存到al

  /* Check if SHM region is already mapped. */

  movq  __afl_area_ptr(%rip), %rdx		;检查共享内存区是否已经初始化
  testq %rdx, %rdx						
  je    __afl_setup						;如果没有初始化则先初始化
										;否则掉进__afl_store
__afl_store:

  /* Calculate and store hit for the code location specified in rcx. */

  xorq __afl_prev_loc(%rip), %rcx		
  xorq %rcx, __afl_prev_loc(%rip)
  shrq $1, __afl_prev_loc(%rip)

  incb (%rdx, %rcx, 1)					;rdx是共享内存基地址,rcx是key

__afl_return:
										;恢复现场
  addb $127, %al
  sahf
  ret

.align 8


.AFL_VARS:

  .lcomm   __afl_area_ptr, 8
  .lcomm   __afl_prev_loc, 8
  .lcomm   __afl_fork_pid, 4
  .lcomm   __afl_temp, 4
  .lcomm   __afl_setup_failure, 1
  .comm    __afl_global_area_ptr, 8, 8
```

最初`__afl_prev_loc = 0`

每次`rcx`携带一个蹦床指纹`key`进来

第一次:

```
rcx = 0 ^ key = key
prev = 0 ^ key ^ 0 = key
prev = key >> 1 
shm[key]++;
```

第二次:

```
rcx = (prev_key >> 1 )^ key
prev = ((prev_key >> 1 )^ key) ^ (prev_key >> 1) = key
prev = key >> 1
shm[(prev_key>>1) ^ key]++;
```

也就是说,`__afl_prev_loc `永远等于上一个key右移一位

那么这个记录`shm[(prev_key>>1) ^ key]++;`的意义是什么呢

上一个key右移一位与当前`key`做异或,在这个值上加一

实际上`(prev_key>>1) ^ key`这个值记录了从上一个代码块到当前代码块的路径,

其`shm`记录值加一意思就是记录这条路径被访问次数+1



这个过程实际上就是实现了[AFL/docs/technical_details.txt at master · google/AFL · GitHub](https://github.com/google/AFL/blob/master/docs/technical_details.txt)中记录的:

```c
cur_location = <COMPILE_TIME_RANDOM>;
shared_mem[cur_location ^ prev_location]++; 
prev_location = cur_location >> 1;
```

### 共享内存初始化

上集说到,`__afl_maybe_log`函数首次调用时会对共享内存区域进行初始化, 发现共享内存未初始化后会进入`__afl_setup`

```asm
__afl_setup:

  /* Do not retry setup if we had previous failures. */

  cmpb $0, __afl_setup_failure(%rip)				;如果失败过一次,那么之后都会失败,开摆
  jne __afl_return									;让你看见loser真的非常抱歉,我会识趣离开

  /* Check out if we have a global pointer on file. */

  movq  __afl_global_area_ptr@GOTPCREL(%rip), %rdx	;如果该指针为空说明还未初始化,跳转__afl_setup_first进行初始化
  movq  (%rdx), %rdx
  testq %rdx, %rdx
  je    __afl_setup_first

  movq %rdx, __afl_area_ptr(%rip)
  jmp  __afl_store

__afl_setup_first:

  /* Save everything that is not yet saved and that may be touched by
     getenv() and several other libcalls we'll be relying on. */

  leaq -352(%rsp), %rsp

  movq %rax,   0(%rsp)
  movq %rcx,   8(%rsp)
  movq %rdi,  16(%rsp)
  movq %rsi,  32(%rsp)
  movq %r8,   40(%rsp)
  movq %r9,   48(%rsp)
  movq %r10,  56(%rsp)
  movq %r11,  64(%rsp)

  movq %xmm0,  96(%rsp)
  movq %xmm1,  112(%rsp)
  movq %xmm2,  128(%rsp)
  movq %xmm3,  144(%rsp)
  movq %xmm4,  160(%rsp)
  movq %xmm5,  176(%rsp)
  movq %xmm6,  192(%rsp)
  movq %xmm7,  208(%rsp)
  movq %xmm8,  224(%rsp)
  movq %xmm9,  240(%rsp)
  movq %xmm10, 256(%rsp)
  movq %xmm11, 272(%rsp)
  movq %xmm12, 288(%rsp)
  movq %xmm13, 304(%rsp)
  movq %xmm14, 320(%rsp)
  movq %xmm15, 336(%rsp)

  /* Map SHM, jumping to __afl_setup_abort if something goes wrong. */

  /* The 64-bit ABI requires 16-byte stack alignment. We'll keep the
     original stack ptr in the callee-saved r12. */

  pushq %r12
  movq  %rsp, %r12
  subq  $16, %rsp
  andq  $0xfffffffffffffff0, %rsp

  leaq .AFL_SHM_ENV(%rip), %rdi
call getenv@PLT					;获取环境变量__AFL_SHM_ID				;检查环境变量中有没有开启AFL共享内存

  testq %rax, %rax
  je    __afl_setup_abort		;如果没有设置此环境变量则中止初始化

  movq  %rax, %rdi
call atoi@PLT

  xorq %rdx, %rdx   /* shmat flags    */								;shmat flag以环境变量__AFL_SHM_ID值传递
  xorq %rsi, %rsi   /* requested addr */
  movq %rax, %rdi   /* SHM ID         */
call shmat@PLT

  cmpq $-1, %rax
  je   __afl_setup_abort

  /* Store the address of the SHM region. */

  movq %rax, %rdx
  movq %rax, __afl_area_ptr(%rip)

  movq __afl_global_area_ptr@GOTPCREL(%rip), %rdx						;至此完成了共享
  movq %rax, (%rdx)
  movq %rax, %rdx
```



映射共享内存

> **Linux 共享内存功能**
>
> 共享内存并不是AFL自己实现的功能,而是Linux提供的进程间通信机制
>
> 共享内存使用的API:
>
> 
>
> ```c
> int shmget(key_t key, size_t size, int shmflg);
> ```
>
> 创建共享内存,该共享内存段明敏为key,共享内存段大小为size,权限标志为shmflg
>
> 返回共享内存标识符
>
> 共享内存创建后不能立刻被任何进程访问, 包括创建者, 还需要映射到进程地址空间中
>
> 
>
> ```c
> void *shmat(int shmid, const void *shmaddr, int shmflg);
> ```
>
> Shared memory Attach, 将共享内存映射进入调用shmat的进程内存
>
> shmid共享内存id, 由shmget返回
>
> shmaddr指定将共享内存区映射到本进程的地址
>
> shmflg指定本进程对该共享内存映射区的读写执行权限
>
> 返回该共享内存区实际映射地址, 如果`shmaddr`不能满足则Linux内核给哥们挑一个返回. 如果失败则返回-1







在`afl-gcc`编译生成的汇编代码`target.s`中,`shmid`直接由环境变量传入, 调用`shmat`, 没有调用`shmget`,  那么这块共享内存是由谁创建的呢?

由上位者`afl–fuzz`创建并传递给下位者—被测程序

```asm
call getenv@PLT					;获取环境变量__AFL_SHM_ID				;检查环境变量中有没有开启AFL共享内存

  testq %rax, %rax
  je    __afl_setup_abort		;如果没有设置此环境变量则中止初始化

  movq  %rax, %rdi
call atoi@PLT

  xorq %rdx, %rdx   /* shmat flags    */								;shmat flag以环境变量__AFL_SHM_ID值传递
  xorq %rsi, %rsi   /* requested addr */
  movq %rax, %rdi   /* SHM ID         */
call shmat@PLT

  cmpq $-1, %rax
  je   __afl_setup_abort

  /* Store the address of the SHM region. */

  movq %rax, %rdx
  movq %rax, __afl_area_ptr(%rip)				;将shmat返回的共享内存映射地址保存到__afl_area_ptr中

  movq __afl_global_area_ptr@GOTPCREL(%rip), %rdx	;并且将该地址保存到__afl_global_area_ptr指针上
  movq %rax, (%rdx)
  movq %rax, %rdx

```

至此, 被测程序`target`中保存好了共享内存映射区

### 启用fork server

`fork server`的作用是, 避免目标程序多次重启, 以提高模糊测试效率

其原理是在目标进程首次启动后,  `AFL`共享内存初始化完毕, 此后目标进程由该进程`fork`出来, 保持了`AFL`共享内存已初始化的状态,  减少了重新初始化共享内存的开销.

要理解`fork server`的作用，必须知道这中间每个线程都在干什么

`afl-fuzz`会亲自扶持一个傀儡目标进程，并亲自和该傀儡进程通信，

`afl-fuzz`创建的共享内存，傀儡进程会将其映射到自己的地址空间

然后傀儡进程此后只负责以自己为模块`fork`出子进程进行模糊测试，并向`afl-fuzz`汇报子进程信息

这里的`client-server`以管道实现，`afl-fuzz`扮演`client`，傀儡进程扮演`server`

`afl-fuzz`通过`199`描述符接收傀儡的汇报，通过`198`描述符向傀儡发送命令，这就建立了半双工的信道

由于傀儡进程以`fork`复制自身创建子进程，因此子进程出生就能访问到共享内存，

傀儡进程的控制流是这样的：



![afl-fuzz控制流](https://raw.githubusercontent.com/DeutschBall/picbed/main/image-20250212235154919.png)

整个`fuzzing`过程如图所示：

![傀儡进程控制流](https://raw.githubusercontent.com/DeutschBall/picbed/main/image-20250213002337941.png)











