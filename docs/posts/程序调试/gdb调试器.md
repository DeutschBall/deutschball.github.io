---
title: gbd调试器
date: 2022-04-22 19:57:20
# tags:
#   - reverse
mathjax: true
---
# gbd调试器的使用

环境:Win11+Kali子系统

## 启动

### 启动 `gdb`

```bash
┌──(root㉿Executor)-[/home/kali]
└─# gdb
GNU gdb (Debian 10.1-2+b1) 10.1.90.20210103-git
Copyright (C) 2021 Free Software Foundation, Inc.
License GPLv3+: GNU GPL version 3 or later <http://gnu.org/licenses/gpl.html>
This is free software: you are free to change and redistribute it.
There is NO WARRANTY, to the extent permitted by law.
Type "show copying" and "show warranty" for details.
This GDB was configured as "x86_64-linux-gnu".
Type "show configuration" for configuration details.
For bug reporting instructions, please see:
<https://www.gnu.org/software/gdb/bugs/>.
Find the GDB manual and other documentation resources online at:
    <http://www.gnu.org/software/gdb/documentation/>.

For help, type "help".
Type "apropos word" to search for commands related to "word".
(gdb)
```

看到命令提示符号变成 `(gdb)`则启动成功

### 安静启动 `gdb -q`

```bash
┌──(root㉿Executor)-[/home/kali]
└─# gdb --silent
(gdb)
```

```
--silent也可以写成-q,-quiet
```

### 分屏启动 `gdb -tui`

```bash
┌──(root㉿Executor)-[/home/kali/mydir]
└─# gdb -tui
```

![image-20220421202637748](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220421202637748.png)

上方窗口是源代码窗口,下方是gbd命令行窗口

这样启动不需要另开一个终端观察源代码

并且当程序在端点停下的时候上方窗口也会显示当前程序停止的位置

上方的源代码窗口使用上下箭头移动视野

### 分屏+安静+指定调试程序 `gdb -tui -q <prog_name>`

注意使用gdb调试的文件必须是可执行文件(windows上的.exe或者linux上的.out等)

并且在编译该可执行文件的时候==必须加入-g选项==生成gbd调试信息

> 如果不使用-g生成了.out文件然后使用gdb调试则
>
> ```bash
> ┌──(root㉿Executor)-[/home/kali/mydir]
> └─# gcc main.c -Og -o  main.out
>
> ┌──(root㉿Executor)-[/home/kali/mydir]
> └─# gdb --silent main.out
> Reading symbols from main.out...
> (No debugging symbols found in main.out)			#报告没有调试信息
> (gdb)
> ```
>
> 使用-tui打开,源代码都看不到
>
> ![image-20220421203357054](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220421203357054.png)

```bash
┌──(root㉿Executor)-[/home/kali/mydir]
└─# gcc main.c -Og -g -o main.out				#使用-g选项生成调试信息

┌──(root㉿Executor)-[/home/kali/mydir]
└─# gdb -tui --silent main.out
```

![image-20220421203550729](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220421203550729.png)

#### 带参数启动 `--args  <程序> <参数1> <参数2>...`

```bash
┌──(root㉿Executor)-[/home/kali/mydir]
└─# gdb -q -tui --args main.out 1 2 3 4
```

这里指定的参数1 2 3 4将会作为 `main.out`执行时的命令行参数

## 启动后运行前

加载需要调试的程序

当在命令行直接使用gdb命令打开gdb调试器时,此时是没有指定需要调试的程序的

### 工作目录 `pwd`

默认工作目录是打开gdb的位置,gdb启动后也可以使用 `pwd`命令观察当前工作目录

```bash
┌──(root㉿Executor)-[/home/kali/mydir]
└─# gdb -q
(gdb) pwd
Working directory /home/kali/mydir.
```

### 指定调试程序位置 `file <prog_name>`

对于当前目录下的程序可以直接使用程序名

```bash
┌──(root㉿Executor)-[/home/kali/mydir]
└─# ls -l|gdb -q
(gdb) Undefined command: "total".  Try "help".
(gdb) Undefined command: "-rw-r--r--".  Try "help".
(gdb) Undefined command: "-rwxr-xr-x".  Try "help".
(gdb) Undefined command: "-rw-r--r--".  Try "help".
(gdb) quit

┌──(root㉿Executor)-[/home/kali/mydir]
└─# ls -l
total 28
-rw-r--r-- 1 root root   139 Apr 21 20:23 main.c
-rwxr-xr-x 1 root root 17672 Apr 21 20:35 main.out
-rw-r--r-- 1 root root    25 Apr 21 20:38 r.txt

┌──(root㉿Executor)-[/home/kali/mydir]
└─# gdb -q
(gdb) file main.out
Reading symbols from main.out...
(gdb)
```

对于其他目录下的可以使用绝对或者相对位置

```bash
(gdb) file /home/kali/mydir/main.out
Load new symbol table from "/home/kali/mydir/main.out"? (y or n) y
Reading symbols from /home/kali/mydir/main.out...
```

### 查看信息

#### 查看当前工作目录 `pwd`

```bash
(gdb) pwd
Working directory /home/kali/mydir.
```

#### 查看是否找到目标程序文件 `list`

```bash
(gdb) list
1       #include <stdio.h>
2       #include <stdlib.h>
3
4
5       int main(int argc,char **argv){
6               for(int i=0;i<argc;++i){
7                       printf("%s",argv[i]);
8               }
9               return 0;
10      }
```

#### 查看调试程序语言 `show language`

```bash
(gdb) show language
The current source language is "auto; currently c".
```

#### 查看源文件信息 `info source`

```bash
(gdb) info source
Current source file is main.c
Compilation directory is /home/kali/mydir
Located in /home/kali/mydir/main.c
Contains 10 lines.
Source language is c.
Producer is GNU C17 11.2.0 -mtune=generic -march=x86-64 -g -Og -fasynchronous-unwind-tables.
Compiled with DWARF 2 debugging format.
Does not include preprocessor macro info.
```

#### 查看可以设置的程序语言 `set language`

```bash
(gdb) set language
Requires an argument. Valid arguments are auto, local, unknown, ada, asm, c, c++, d, fortran, go, minimal, modula-2, objective-c, opencl, pascal, rust.
```

#### 查看程序运行状态 `info program`

```bash
(gdb) info prog
The program being debugged is not being run.
```

### 设置信息

#### 设置命令行参数 `set args <参数1> <参数2>...`

```
(gdb) set args 1 2 3
(gdb) show args
Argument list to give program being debugged when it is started is "1 2 3".
```

如果在启动时有指定参数,此时再用set指定参数则会覆盖启动时设置的参数

#### 设置语言'set language <语言>'

```bash
(gdb) set language c
```

## 运行

### 运行程序 `run`

命令行参数使用启动时指定的参数或者set args设置的参数,如果都没有给定则无参数执行

如果有断点则程序在第一个断点处停止,否则直接运行完.

#### 带参数运行 `run <参数1> <参数2>...`

此参数将会直接作为运行参数,覆盖前面设置的参数

### main停止运行 `start`

`start`相当于在main函数处下了断点然后 `run`,自动在main开始前停下

## 运行时

### 断点

#### 设置断点 `b <行号>`

断点可以运行前设置也可以运行时设置

```bash
(gdb) b 6
Breakpoint 6 at 0x555555555142: file main.c, line 6.
```

如果以-tui分屏打开,则设置好的断点会显示在行号左侧,大写的B+>意味当前程序暂停的断点

![image-20220421213142314](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220421213142314.png)

##### `b <函数名>`直接给函数下断点

```
(gdb) b main
Breakpoint 10 at 0x555555555139: file main.c, line 5.
```

#### 删除断点 `delete <断点编号>`

注意端点编号不是行号

删除全部断点则不指定编号,直接 `delete`

##### 删除指定行上的断点 `clear <行号>`

#### 条件断点 `b if <条件>`

比如如果没有输入命令行参数时才给main函数下断点

```bash
(gdb) b main if argc==1					#用户没有输入时argc=1,第一个参数是当前程序位置
Breakpoint 11 at 0x555555555139: file main.c, line 5.
```

#### 查看断点信息 `info b <断点号>`

```bash
Breakpoint 11 at 0x555555555139: file main.c, line 5.
(gdb) info b 11
Num     Type           Disp Enb Address            What
11      breakpoint     keep y   0x0000555555555139 in main at main.c:5
        stop only if argc==1
```

##### `info b`查看所有断点信息

```bash
(gdb) info b
Num     Type           Disp Enb Address            What
11      breakpoint     keep y   0x0000555555555139 in main at main.c:5
        stop only if argc==1
12      breakpoint     keep y   0x0000555555555142 in main at main.c:6
13      breakpoint     keep y   0x0000555555555149 in main at main.c:7
```

### 查看信息

#### print命令

##### 查看函数信息 `p <函数名>`

函数信息也可以在运行前查看

```bash
(gdb) p main
$6 = {int (int, char **)} 0x555555555139 <main>
```

```bash
{返回值类型(参数1类型,参数2类型)} 函数地址 <函数名>
```

```
(gdb) whatis main
type = int (int, char **)
(gdb) ptype main
type = int (int, char **)
```

##### 查看变量信息 `p <变量名>`

查看变量信息必须是程序在该变量下文的断点处停下

即当前程序的运行位置必须已经经过变量,并且变量没有消亡

比如函数中的局部变量在函数返回之后就会消亡,只能在函数中断点然后查看断点之前的变量

如图调试一个用循环计算阶乘的函数,将断点下在第10行 `result*=n`处

![image-20220422175357420](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220422175357420.png)

当程序第一次执行到次时会停在 `result*=n`==执行前==的状态

![image-20220422175511240](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220422175511240.png)

如图第一次在第10行停下,打印result=1

##### 查看寄存器信息 `p $<寄存器名>`

对于刚才的fact循环求阶乘函数,最后返回值是result,可想而知,该值是存放在rax寄存器中的

```c
int fact(int n){
        if(n<0)return n;
        if(n==0)return 1;
        int result=1;
        while(n>0){
                result*=n;
                --n;

        }
        return result;
}
```

下面调试程序验证猜想

![image-20220422180106540](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220422180106540.png)

还是将断点下到第10行while循环中

逐次进行循环,观察rax寄存器中的值

![image-20220422180159934](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220422180159934.png)

与result的变化是一致的

**也可以查看程序计数器 `rip`中的值,观察程序当前进行位置**

![image-20220422180413841](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220422180413841.png)

用objdump反编译然后观察fact+13处的指令

![image-20220422180540637](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220422180540637.png)

`fact+13=0x1139+0x13=0x114c`,该位置是一个 `test %edi,%edi`指令,而n作为第一个参数是存放在edi寄存器中的

![image-20220422180821161](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220422180821161.png)

紧接着114e处 `jg 1146`意味如果 `R[%edi]=n>0`则跳转1146位置,

而1146位置在114e上方,相当于跳进了循环,

也就是说0x114c处相当于循环判断 `while(n>0)`

即程序在第10行的断点停下时rip中是第9行中的条件判断指令

#### x/<大小> <位置>检查字节或者字

##### `x/20b fact`检查fact函数的前20个字节

![image-20220422181438589](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220422181438589.png)

与objdump得到的反汇编是一样的

##### x/2g 0x555555555139 检查从0x555555555139地址开始的双字

![image-20220422181756825](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220422181756825.png)

#### info命令

##### 查看所有寄存器信息 `info registers`

![image-20220422181858252](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220422181858252.png)

其中 `rax`存放result,`rdi`存放n

##### 查看栈帧'info frame'

![image-20220422182024087](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220422182024087.png)

#### disas命令

##### 反汇编当前程序暂停的函数 `disas`

首先要在函数里下断点,然后程序在该断点暂停时使用disas可以观察当前函数的反汇编信息

![image-20220422182255390](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220422182255390.png)

可见反汇编信息中也会有当前断点位置信息

如此就不用再开一个终端使用objdump观察了

##### 反汇编指定名称的函数 `disas <函数名>`

此方法不需要在函数中下断点

```
(gdb) disas fact
```

![image-20220422182507141](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220422182507141.png)

##### 反汇编某个地址附近的函数 `disas <地址>`

```
disas 0x000055555555514c
```

![image-20220422182706003](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220422182706003.png)

### 继续执行

执行有多种情况,通常会与断点或者一些逻辑结构联合使用,

比如在断点处停下或者不停下

在循环处,在函数中都有特殊的命令决定如何执行

```bash
源代码层面
next		单步执行,不进入函数,但是函数会执行然后返回值
next n		单步执行n行,均不进入函数

step		单步执行,进入函数
step n		单步执行n行,均进入函数

continue	恢复执行,直到预见下一个断点
continue n	恢复执行,并忽略下面的n个断点

finish		一直运行直到当前函数返回后停止,忽略断点

return		放弃后面的执行直接return


机器码层面(或者说汇编代码层面)
stepi		单步执行一条指令,进入函数
stepi n

nexti		单步执行一条指令,不进入函数(不会call)
nexti n

until		一直运行当前循环,在出循环之后的第一条语句停下,如果循环内有断点则在断点停下
			实际上在机器码层面上,一直运行直到一个内存地址比当前更大的指令处停下
```

#### 源代码层面

以一个递归求阶乘的程序为例子

```bash
┌──(root㉿Executor)-[/home/kali/mydir]
└─# cat main.c
#include <stdio.h>
#include <stdlib.h>


int fact(int n){
        if(n<0)return n;
        if(n==0)return 1;
        return n*fact(n-1);
}



int main(int argc,char **argv){
        int ans=123456;
        ans=fact(9);
        printf("%d",ans);


        return 0;
}
```

##### next单步步过

在main函数处下断点,使得程序上来先停一下,让我们有机会一行一行地执行

```
(gdb) b main
Breakpoint 3 at 0x55555555515a: file main.c, line 13.
```

![image-20220422185956239](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220422185956239.png)

第一个n命令使得程序断在 `15:ans=fact(123456)`

第二个n命令使得程序断在 `16:printf("%d",ans)`

此时使用print命令观察ans的值发现其确实是9的阶乘,即第15行是自动执行然后返回了值的,单步步过只是忽略了执行细节,只要函数的执行后果

##### step单步步入

还是在main函数处下断点,然后使用step

![image-20220422190333043](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220422190333043.png)

第一个step命令会让程序断在 `15:ans=fact(9)`这与next是相同的

但是下一个step会进入step并在都5行停下

##### continue执行到下一个断点

在main函数开始(line 13)和main函数中打印ans前(line16)各打一个断点

![image-20220422190554335](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220422190554335.png)

run运行之后会在13行停下,然后在输入c命令则会直接在16行停下

![image-20220422190646915](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220422190646915.png)

此时print命令打印ans值发现为362880确实是9的阶乘,即两个断点之间的所有程序都被执行过了

##### finish一直运行到当前函数返回

分两种情况,有没有进入函数

使用step命令让程序在第一层递归函数==入口前==停下,此时使用finish

![image-20220422191432439](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220422191432439.png)

发现程序直接返回到了main函数中,并且带着返回值 `362880`恰好是9的阶乘,说明递归函数各层都执行了

现在让程序在第一层递归函数的==内部==停下

![image-20220422192218738](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220422192218738.png)

发现进入的递归函数的第二层

##### return 放弃函数未执行的部分,直接返回到调用者

![image-20220422192641695](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220422192641695.png)

fact(6)返回到fact(7)

然后一直使用finish命令返回main函数

![image-20220422192818544](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220422192818544.png)

发现ans值并没有被正确地计算

即return会放弃下文

#### 机器码层面

##### until 在循环体的机器码的最高地址时挑出循环到第一条高于循环地址的指令

调试一个使用循环计算阶乘的函数fact

```c
┌──(root㉿Executor)-[/home/kali/mydir]
└─# cat main.c
#include <stdio.h>
#include <stdlib.h>


int fact(int n){
        if(n<0)return n;
        if(n==0)return 1;

        int result=1;

        while(n>0){
                result*=n;
                --n;

        }
        return result;
}



int main(int argc,char **argv){
        int ans=123456;
        ans=fact(9);
        printf("%d",ans);


        return 0;
}
```

在main函数打一个断点方便单步调试

一直使用step单步步入命令,直到第一次到达while条件判断的时候,使用disas观察反汇编代码

![image-20220422194448277](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220422194448277.png)

此时对应指令fact+19位置

此时再使用一次单步步入,进入循环,`line 12:result*=n`

![image-20220422194622378](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220422194622378.png)

对应指令fact+13位置

即源代码的执行顺序和机器码相反

显然是由于刚才的fact+21的jg条件跳转满足,跳到了fact+13

此时使用until只是相当于step命令,因为until只会在循环的机器码层面的最大地址处才会有快速执行循环的作用

![image-20220422194902282](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220422194902282.png)

继续disas观察反汇编发现 `line13:--n`对应反汇编的fact+16

此时再使用u

![image-20220422195028273](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220422195028273.png)

源代码层面进行循环条件判断,对应机器码层面test判断,而fact+19就是循环体在机器层面的最高地址

此时再使用u

![image-20220422195116698](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220422195116698.png)

直接返回了main函数,这是因为fact函数中while循环结束立刻就返回了,对应机器码

![image-20220422195301219](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220422195301219.png)

第23行是循环外首条高于循环的地址,该条指令又是返回,因此返回了main函数

返回main后打印ans值发现是362880是9的阶乘,证明until指令会执行循环体剩下的部分
