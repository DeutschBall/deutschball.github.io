---
title: [AFL VI] afl-gcc
date: 2025-10-30 13:11:00
tags: 模糊测试
mathjax: true




---



# [AFL VI] afl-gcc & afl-as

## 插桩

`afl-gcc`和`afl-as`是AFL提供的用于插桩的编译工具, 替代`gcc`和`as`使用

插桩的目的是, 统计每个基本块的访达情况, 计算覆盖率.

插桩的原理是, 在每个基本块(`basic block`)的入口处插入一条`call 桩函数`的指令, 携带该基本块的id作为参数, 在桩函数的位图中记录该基本块的访达情况.

## afl-gcc

afl-gcc调用gcc, 使用afl-as, 不使用默认的as

使用命令afl-gcc将目标程序编译

```sh
afl-gcc /home/dustball/fuzz/main.c 
	-o /home/dustball/fuzz/main_afl 
	-g -no-pie -O0 
```



实际上afl-gcc将该命令转化为

```sh
gcc /home/dustball/fuzz/main.c 
	-o /home/dustball/fuzz/main_afl 
	-g -no-pie -O0 
	-B /usr/src/AFL -g -O3 -funroll-loops 
	-D__AFL_COMPILER=1 
	-DFUZZING_BUILD_MODE_UNSAFE_FOR_PRODUCTION=1
```

这里`-B /usr/src/AFL`将会使gcc去`/usr/src/AFL`目录下寻找编译工具组件比如`as`, 

而AFL会在该目录下创建一个`as`到`afl-as`的链接, 

因此`gcc -B /usr/src/AFL`使用的`as`就是`afl-as`

```sh
┌──(root㉿DustReich)-[/usr/src/AFL]
└─# ls -l as
lrwxrwxrwx 1 root root 6 Oct 30 15:59 as -> afl-as
```



```c

int main(int argc, char** argv) {

  if (isatty(2) && !getenv("AFL_QUIET")) {

    SAYF(cCYA "afl-cc " cBRI VERSION cRST " by <lcamtuf@google.com>\n");

  } else be_quiet = 1;

  if (argc < 2) {

    SAYF("\n"
         "This is a helper application for afl-fuzz. It serves as a drop-in replacement\n"
         "for gcc or clang, letting you recompile third-party code with the required\n"
         "runtime instrumentation. A common use pattern would be one of the following:\n\n"

         "  CC=%s/afl-gcc ./configure\n"
         "  CXX=%s/afl-g++ ./configure\n\n"

         "You can specify custom next-stage toolchain via AFL_CC, AFL_CXX, and AFL_AS.\n"
         "Setting AFL_HARDEN enables hardening optimizations in the compiled code.\n\n",
         BIN_PATH, BIN_PATH);

    exit(1);

  }

  find_as(argv[0]); //寻找afl-as, 并将其路径保存在as_path中

  edit_params(argc, argv);  //修改gcc参数

  execvp(cc_params[0], (char**)cc_params);  //调用afl-gcc,传递新的gcc参数

  FATAL("Oops, failed to execute '%s' - check your PATH", cc_params[0]);

  return 0;

}

```

到此皮球踢到了afl-as脚下

## afl-as

add_instrument函数中进行插桩, 在汇编语言层面进行插桩



首先使用gcc将源代码编译为.s汇编代码, 在/tmp下生成临时产物

然后再/tmp下生成插桩后汇编语言



比如main.c编译完成后生成的汇编代码如下

```asm
┌──(root㉿DustReich)-[/usr/src/AFL]
└─# cat /tmp/ccj7VEm5.s
        .file   "main.c"
        .text
.Ltext0:
        .file 0 "/home/dustball/fuzz" "main.c"
        .section        .text.startup,"ax",@progbits
        .p2align 4
        .globl  main
        .type   main, @function
main:
.LFB11:
        .file 1 "main.c"
        .loc 1 3 11 view -0
        .cfi_startproc
        .loc 1 4 5 view .LVU1
        .loc 1 5 5 view .LVU2
        .loc 1 3 11 is_stmt 0 view .LVU3
        pushq   %rbx
        .cfi_def_cfa_offset 16
        .cfi_offset 3, -16
        .loc 1 5 5 view .LVU4
        movl    $256, %edx
        xorl    %edi, %edi
        .loc 1 3 11 view .LVU5
        subq    $16, %rsp
        .cfi_def_cfa_offset 32
        .loc 1 5 5 view .LVU6
        leaq    6(%rsp), %rbx
        movq    %rbx, %rsi
        call    read@PLT
.LVL0:
        .loc 1 6 5 is_stmt 1 view .LVU7
        movq    %rbx, %rdi
        call    puts@PLT
.LVL1:
        .loc 1 7 5 view .LVU8
        .loc 1 10 1 is_stmt 0 view .LVU9
        addq    $16, %rsp
        .cfi_def_cfa_offset 16
        xorl    %eax, %eax
        popq    %rbx
        .cfi_def_cfa_offset 8
        ret
        .cfi_endproc
.LFE11:
        .size   main, .-main
        .text
.Letext0:
        .file 2 "/usr/lib/gcc/x86_64-linux-gnu/14/include/stddef.h"
        .file 3 "/usr/include/x86_64-linux-gnu/bits/types.h"
        .file 4 "/usr/include/stdio.h"
        .file 5 "/usr/include/unistd.h"
        .file 6 "<built-in>"
        .section        .debug_info,"",@progbits
.Ldebug_info0:
        .long   0x132
        .value  0x5
	...
```

插桩时只对其中的代码段感兴趣, 比如这里.LFB11,以及.LVL0等等



### 插桩内容

#### afl_maybe_log 每个基本块一个

```c
/* --- AFL TRAMPOLINE (64-BIT) --- */

.align 4

leaq -(128+24)(%rsp), %rsp
movq %rdx,  0(%rsp)
movq %rcx,  8(%rsp)
movq %rax, 16(%rsp)
movq $随机数, %rcx
call __afl_maybe_log
movq 16(%rsp), %rax
movq  8(%rsp), %rcx
movq  0(%rsp), %rdx
leaq (128+24)(%rsp), %rsp

/* --- END --- */
```

### main_payload 整个程序一个用于初始化

```asm
/* --- AFL MAIN PAYLOAD (64-BIT) --- */

.text
.att_syntax
.code64
.align 8

__afl_maybe_log:

  lahf
  seto  %al

  /* Check if SHM region is already mapped. */

  movq  __afl_area_ptr(%rip), %rdx
  testq %rdx, %rdx
  je    __afl_setup

__afl_store:

  /* Calculate and store hit for the code location specified in rcx. */

  xorq __afl_prev_loc(%rip), %rcx
  xorq %rcx, __afl_prev_loc(%rip)
  shrq $1, __afl_prev_loc(%rip)

  incb (%rdx, %rcx, 1)

__afl_return:

  addb $127, %al
  sahf
  ret

.align 8

__afl_setup:

  /* Do not retry setup if we had previous failures. */

  cmpb $0, __afl_setup_failure(%rip)
  jne __afl_return

  /* Check out if we have a global pointer on file. */

  movq  __afl_global_area_ptr@GOTPCREL(%rip), %rdx
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
call getenv@PLT

  testq %rax, %rax
  je    __afl_setup_abort

  movq  %rax, %rdi
call atoi@PLT

  xorq %rdx, %rdx   /* shmat flags    */
  xorq %rsi, %rsi   /* requested addr */
  movq %rax, %rdi   /* SHM ID         */
call shmat@PLT

  cmpq $-1, %rax
  je   __afl_setup_abort

  /* Store the address of the SHM region. */

  movq %rax, %rdx
  movq %rax, __afl_area_ptr(%rip)

  movq __afl_global_area_ptr@GOTPCREL(%rip), %rdx
  movq %rax, (%rdx)
  movq %rax, %rdx

__afl_forkserver:

  /* Enter the fork server mode to avoid the overhead of execve() calls. We
     push rdx (area ptr) twice to keep stack alignment neat. */

  pushq %rdx
  pushq %rdx

  /* Phone home and tell the parent that we're OK. (Note that signals with
     no SA_RESTART will mess it up). If this fails, assume that the fd is
     closed because we were execve()d from an instrumented binary, or because
     the parent doesn't want to use the fork server. */

  movq $4, %rdx               /* length    */
  leaq __afl_temp(%rip), %rsi /* data      */
  movq $(198 + 1), %rdi       /* file desc */
call write@PLT

  cmpq $4, %rax
  jne  __afl_fork_resume

__afl_fork_wait_loop:

  /* Wait for parent by reading from the pipe. Abort if read fails. */

  movq $4, %rdx               /* length    */
  leaq __afl_temp(%rip), %rsi /* data      */
  movq $198, %rdi             /* file desc */
call read@PLT
  cmpq $4, %rax
  jne  __afl_die

  /* Once woken up, create a clone of our process. This is an excellent use
     case for syscall(__NR_clone, 0, CLONE_PARENT), but glibc boneheadedly
     caches getpid() results and offers no way to update the value, breaking
     abort(), raise(), and a bunch of other things :-( */

call fork@PLT
  cmpq $0, %rax
  jl   __afl_die
  je   __afl_fork_resume

  /* In parent process: write PID to pipe, then wait for child. */

  movl %eax, __afl_fork_pid(%rip)

  movq $4, %rdx                   /* length    */
  leaq __afl_fork_pid(%rip), %rsi /* data      */
  movq $(198 + 1), %rdi             /* file desc */
call write@PLT

  movq $0, %rdx                   /* no flags  */
  leaq __afl_temp(%rip), %rsi     /* status    */
  movq __afl_fork_pid(%rip), %rdi /* PID       */
call waitpid@PLT
  cmpq $0, %rax
  jle  __afl_die

  /* Relay wait status to pipe, then loop back. */

  movq $4, %rdx               /* length    */
  leaq __afl_temp(%rip), %rsi /* data      */
  movq $(198 + 1), %rdi         /* file desc */
call write@PLT

  jmp  __afl_fork_wait_loop

__afl_fork_resume:

  /* In child process: close fds, resume execution. */

  movq $198, %rdi
call close@PLT

  movq $(198 + 1), %rdi
call close@PLT

  popq %rdx
  popq %rdx

  movq %r12, %rsp
  popq %r12

  movq  0(%rsp), %rax
  movq  8(%rsp), %rcx
  movq 16(%rsp), %rdi
  movq 32(%rsp), %rsi
  movq 40(%rsp), %r8
  movq 48(%rsp), %r9
  movq 56(%rsp), %r10
  movq 64(%rsp), %r11

  movq  96(%rsp), %xmm0
  movq 112(%rsp), %xmm1
  movq 128(%rsp), %xmm2
  movq 144(%rsp), %xmm3
  movq 160(%rsp), %xmm4
  movq 176(%rsp), %xmm5
  movq 192(%rsp), %xmm6
  movq 208(%rsp), %xmm7
  movq 224(%rsp), %xmm8
  movq 240(%rsp), %xmm9
  movq 256(%rsp), %xmm10
  movq 272(%rsp), %xmm11
  movq 288(%rsp), %xmm12
  movq 304(%rsp), %xmm13
  movq 320(%rsp), %xmm14
  movq 336(%rsp), %xmm15

  leaq 352(%rsp), %rsp

  jmp  __afl_store

__afl_die:

  xorq %rax, %rax
call _exit@PLT

__afl_setup_abort:

  /* Record setup failure so that we don't keep calling
     shmget() / shmat() over and over again. */

  incb __afl_setup_failure(%rip)

  movq %r12, %rsp
  popq %r12

  movq  0(%rsp), %rax
  movq  8(%rsp), %rcx
  movq 16(%rsp), %rdi
  movq 32(%rsp), %rsi
  movq 40(%rsp), %r8
  movq 48(%rsp), %r9
  movq 56(%rsp), %r10
  movq 64(%rsp), %r11

  movq  96(%rsp), %xmm0
  movq 112(%rsp), %xmm1
  movq 128(%rsp), %xmm2
  movq 144(%rsp), %xmm3
  movq 160(%rsp), %xmm4
  movq 176(%rsp), %xmm5
  movq 192(%rsp), %xmm6
  movq 208(%rsp), %xmm7
  movq 224(%rsp), %xmm8
  movq 240(%rsp), %xmm9
  movq 256(%rsp), %xmm10
  movq 272(%rsp), %xmm11
  movq 288(%rsp), %xmm12
  movq 304(%rsp), %xmm13
  movq 320(%rsp), %xmm14
  movq 336(%rsp), %xmm15

  leaq 352(%rsp), %rsp

  jmp __afl_return

.AFL_VARS:

  .lcomm   __afl_area_ptr, 8
  .lcomm   __afl_prev_loc, 8
  .lcomm   __afl_fork_pid, 4
  .lcomm   __afl_temp, 4
  .lcomm   __afl_setup_failure, 1
  .comm    __afl_global_area_ptr, 8, 8

.AFL_SHM_ENV:
  .asciz "__AFL_SHM_ID"
```







### 插桩算法

1. 以\t开头紧跟字母的, 一定是代码段的指令, 对齐插桩.

```c
    if (!pass_thru && !skip_intel && !skip_app && !skip_csect && instr_ok &&
        instrument_next && line[0] == '\t' && isalpha(line[1])) {

      fprintf(outf, use_64bit ? trampoline_fmt_64 : trampoline_fmt_32,
              R(MAP_SIZE));

      instrument_next = 0;
      ins_lines++;
    }

```

但是两条相邻的mov指令一定会顺序执行, 后者上不需要插桩, 怎么做到只给基本块的开头位置插桩呢?这就有规则2

2. 以\t开头紧跟j字母的, 一定是条件跳转比如jz, jnz等等, 在该指令之后立刻插桩, 意义是如果jnz不实现, 则顺序进入jnz之后的基本块. 

```c
    /* If we're in the right mood for instrumenting, check for function
       names or conditional labels. This is a bit messy, but in essence,
       we want to catch:

         ^main:      - function entry point (always instrumented)
         ^.L0:       - GCC branch label
         ^.LBB0_0:   - clang branch label (but only in clang mode)
         ^\tjnz foo  - conditional branches

       ...but not:

         ^# BB#0:    - clang comments
         ^ # BB#0:   - ditto
         ^.Ltmp0:    - clang non-branch labels
         ^.LC0       - GCC non-branch labels
         ^.LBB0_0:   - ditto (when in GCC mode)
         ^\tjmp foo  - non-conditional jumps

       Additionally, clang and GCC on MacOS X follow a different convention
       with no leading dots on labels, hence the weird maze of #ifdefs
       later on.

     */

    if (skip_intel || skip_app || skip_csect || !instr_ok ||
        line[0] == '#' || line[0] == ' ') continue;		//跳过注释以及.s文件中非代码段

    /* Conditional branch instruction (jnz, etc). We append the instrumentation
       right after the branch (to instrument the not-taken path) and at the
       branch destination label (handled later on). */

    if (line[0] == '\t') {//对于jmp命令

      if (line[1] == 'j' && line[2] != 'm' && R(100) < inst_ratio) {

        fprintf(outf, use_64bit ? trampoline_fmt_64 : trampoline_fmt_32,
                R(MAP_SIZE));

        ins_lines++;

      }

      continue;

    }
```

那么如果jnz实现, 是否还需要对跳转过去的基本块插桩呢?这就有规则3:



3. 如果该行是一个**分支标号**

​	如果是一个函数, 则插桩

​	如果不是一个函数, 说明是一个跳转分支, 也插桩

```c
    if (strstr(line, ":")) {

      if (line[0] == '.') {


        /* .L0: or LBB0_0: style jump destination */

        /* Apple: .L<num> / .LBB<num> */

        if ((isdigit(line[2]) || (clang_mode && !strncmp(line + 1, "LBB", 3)))
            && R(100) < inst_ratio) {

          /* An optimization is possible here by adding the code only if the
             label is mentioned in the code in contexts other than call / jmp.
             That said, this complicates the code by requiring two-pass
             processing (messy with stdin), and results in a speed gain
             typically under 10%, because compilers are generally pretty good
             about not generating spurious intra-function jumps.

             We use deferred output chiefly to avoid disrupting
             .Lfunc_begin0-style exception handling calculations (a problem on
             MacOS X). */

          if (!skip_next_label) instrument_next = 1; else skip_next_label = 0;

        }

      } else {

        /* Function label (always instrumented, deferred mode). */

        instrument_next = 1;
    
      }

    }
```







4. 在整个汇编文件最后插入main_payload_64

   











