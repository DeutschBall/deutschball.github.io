---
title: glibc 相关备忘 
date: 2024-10-17 23:20:00
tags: heap exploit
mathjax: true




---











# 源码调试Glibc

## 系统自带glibc的缺点

在我们尝试观察延迟绑定机制时,

需要观察_dl_runtime_resolve和dl_fixup这两个函数

这两个函数都位于ld-linux.so.2 动态库中



默认情况下使用gcc编译程序时,动态链接的glibc动态库文件,都在/lib下

```c
root@Destroyer:/usr/src/CTF-All-In-One/src/writeup/6.1.3_pwn_xdctf2015_pwn200# ldd /bin/cat
        linux-vdso.so.1 (0x00007fffee15a000)
        libc.so.6 => /lib/x86_64-linux-gnu/libc.so.6 (0x00007f36b527b000)
        /lib64/ld-linux-x86-64.so.2 (0x00007f36b5875000)
root@Destroyer:/usr/src/CTF-All-In-One/src/writeup/6.1.3_pwn_xdctf2015_pwn200# ldd ./test
        linux-gate.so.1 (0xf7f33000)
        libc.so.6 => /lib/i386-linux-gnu/libc.so.6 (0xf7d3b000)
        /lib/ld-linux.so.2 (0xf7f35000)
```

|          | libc                            | ld                          |
| -------- | ------------------------------- | --------------------------- |
| 32位程序 | /lib/i386-linux-gnu/libc.so.6   | /lib/ld-linux.so.2          |
| 64位程序 | /lib/x86_64-linux-gnu/libc.so.6 | /lib64/ld-linux-x86-64.so.2 |

这是安装ubuntu这种发行版时系统自带的glibc-release版

```c
root@Destroyer:/lib/i386-linux-gnu# file ld-2.27.so
ld-2.27.so: ELF 32-bit LSB shared object, Intel 80386, version 1 (SYSV), dynamically linked, BuildID[sha1]=8da666988713e9bb88f4eb5d27dc35d815cf006b, stripped
```

可以看到调试符号信息已经被strip了

就算我们编译一个c程序时加入了-g选项,也只是保留了程序领空内的所有符号信息,该程序链接的glibc照样是没有调试符号的

```c
gef➤  info sharedlibrary
From        To          Syms Read   Shared Object Library
0xf7fd6ab0  0xf7ff18bb  Yes (*)     /lib/ld-linux.so.2
0xf7df4690  0xf7f414b6  Yes (*)     /lib/i386-linux-gnu/libc.so.6
(*): Shared library is missing debugging information.
```

两个库都标着*,意思是缺乏调试信息



如果我们想要调试glibc,或者说能够保留glibc中的符号,比如函数名,变量名之类,需要带有符号的glibc

可以自己编译一个玩



以我的wsl kali-linux为例,装机自带的libc版本号是2.38

```c
┌──(dustball㉿Destroyer)-[~]
└─$ ldd --version
ldd (Debian GLIBC 2.38-13) 2.38
Copyright (C) 2023 Free Software Foundation, Inc.
This is free software; see the source for copying conditions.  There is NO
warranty; not even for MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
Written by Roland McGrath and Ulrich Drepper.
```

下面我们编译一个新的带有调试符号的2.38版本的glibc

## 编译64位glibc

### 下载glibc

首先下载glibc源码

```
apt install glibc-source
```

执行完后会在/usr/src下面生成glibc目录

```
┌──(root㉿Destroyer)-[/usr/src/glibc]
└─# ls
debian  glibc-2.38.tar.xz
```

> 这个方法不太靠谱，我在另一台机器的wsl上这样整，缺少texinfo源代码
>
> 还是到仓库下载源代码稳妥

或者到glibc仓库[http://ftp.gnu.org/gnu/glibc/](http://ftp.gnu.org/gnu/glibc/)挑一个下载

或者到镜像仓库下载https://mirrors.aliyun.com/gnu/glibc/

比如

```sh
curl http://ftp.gnu.org/gnu/glibc/glibc-2.38.tar.xz -o glibc-2.38.tar.xz
```

### 解压glibc

```c
tar -xf glibc-2.38.tar.xz
```

### 建立bulid目录

```
cd glibc-2.38
mkdir build
cd build
```

### 配置编译选项

在build路径下

```
../configure --prefix=/home/glibc/ --enable-add-ons=nptl --with-tls --with-__thread --enable-kernel=2.6.32 --enable-debug --disable-werror 
```

```
../configure --prefix=/home/glibc32/glibc-2.38 --enable-add-ons=nptl --with-tls --with-__thread --enable-kernel=2.6.32 --enable-debug --disable-werror 
```



```
../configure --prefix=/home/dustball/glibc/glibc-2.35 --enable-add-ons=nptl --with-tls --with-__thread --enable-kernel=2.6.32 --enable-debug --disable-werror
```



```
../configure --prefix=/home/dustball/glibc/glibc-2.27 --enable-add-ons=nptl --with-tls --with-__thread --enable-kernel=2.6.32 --enable-debug --disable-werror
```



```
../configure --prefix=/home/dustball/glibc/glibc-2.31 --enable-add-ons=nptl --with-tls --with-__thread --enable-kernel=2.6.32 --enable-debug --disable-werror
```

```
../configure --prefix=/home/dustball/glibc/glibc-2.35 --enable-add-ons=nptl --with-tls --with-__thread --enable-kernel=2.6.32 --enable-debug --disable-werror
```







这里`--prefix=/home/glibc`是决定`make install`的安装地址

`–-enable-debug`允许调试,实际上就是给gcc传递-g编译选项

### 编译&安装

```
make -j `nproc`
make install
```

> 如果配置编译选项时prefix没有写或者写错了也没关系
>
> ```
> make install DESTDIR=/home/glibc/
> ```
>
> 这样安装也可以

如果编译和安装都没有错误,会在`/home/glibc/`下生成我们的货

```c
┌──(root㉿Destroyer)-[/home/glibc]
└─# ls
bin  etc  include  lib  libexec  sbin  share  var
```

动态库在lib下面放着了

```c
┌──(root㉿Destroyer)-[/home/glibc/lib]
└─# file libc.so.6
libc.so.6: ELF 64-bit LSB shared object, x86-64, version 1 (GNU/Linux), dynamically linked, interpreter /home/glibc/lib/ld-linux-x86-64.so.2, BuildID[sha1]=a8ebdd4a75fecb70ba9fe1dc5765fcd87c77742e, for GNU/Linux 3.2.0, with debug_info, not stripped
```

非常滴漂亮

## 交叉编译32位glibc(可选)

在x86_64 linux上,也兼容32位的程序

如果想要32位带符号glibc的支持,需要再编译一个32位的glibc

下载和解压不用做了,还是利用之前编译64位glibc时的源码即可

### 建立build32目录

```c
cd glibc-2.38
mkdir build32
cd build32
```

### 配置32位编译选项

首先让gcc能够编译32位程序,需要安装一些依赖

```
apt-get install build-essential module-assistant gcc-multilib g++-multilib 
```

然后配置编译选项

```
../configure --prefix=/home/glibc32 --host=i686-pc-linux-gnu --enable-add-ons=nptl --with-tls --with-__thread --enable-kernel=2.6.32 --with-binutils=/usr/bin --with-headers=/usr/include --build=i686-linux-gnu CC="gcc -m32" CXX="g++ -m32"
```

### 编译&安装

```
make -j`nproc`
make install
```

如果编译安装都没有错误,会在/home/glibc32下面生成我们的货

```
┌──(root㉿Destroyer)-[/home]
└─# ls
dustball  glibc  glibc32
```

```c
┌──(root㉿Destroyer)-[/home/glibc32/lib]
└─# file libc.so.6
libc.so.6: ELF 32-bit LSB shared object, Intel 80386, version 1 (GNU/Linux), dynamically linked, interpreter /lib/ld-linux.so.2, BuildID[sha1]=3d4a2e7c0e16c8cc778b5bd574a59eb4988e2d96, for GNU/Linux 3.2.0, with debug_info, not stripped
```

漂亮滴很

## 编译链接glibc

现在系统里面有两个glibc

一个系统自带的没有调试符号的glibc在/lib下面

一个我们自己编译的有调试符号的glibc在/home/glibc下面

但是天无二日,程序只能链接一个glibc,并且程序默认链接到/lib下的老太阳

```c
┌──(root㉿Destroyer)-[/home/glibc-test]
└─# ldd main
        linux-vdso.so.1 (0x00007fff451fb000)
        libc.so.6 => /lib/x86_64-linux-gnu/libc.so.6 (0x00007f93106d0000)
        /lib64/ld-linux-x86-64.so.2 (0x00007f93108c0000)
```

如何让程序链接到我们自己编译的glibc呢?

gcc有一个编译选项可以指定链接libc的位置

```
gcc main.c -o main -Wl,--rpath=/home/glibc/lib -Wl,--dynamic-linker=/home/glibc/lib/ld-linux-x86-64.so.2   -I/home/glibc/include -g -no-pie
```

`-Wl,--rpath=/home/glibc/lib`指定glibc路径

`-Wl,--dynamic-linker=/home/glibc/lib/ld-linux-x86-64.so.2`指定动态链接器的路径

`-I/home/glibc/include`指定头文件路径

```c
┌──(root㉿Destroyer)-[/home/glibc-test]
└─# ./main
Hello, world!

┌──(root㉿Destroyer)-[/home/glibc-test]
└─# file main
main: ELF 64-bit LSB executable, x86-64, version 1 (SYSV), dynamically linked, interpreter /home/glibc/lib/ld-linux-x86-64.so.2, BuildID[sha1]=27284e24ab02fa64103591192dd8b3b006ae20f5, for GNU/Linux 3.2.0, with debug_info, not stripped

┌──(root㉿Destroyer)-[/home/glibc-test]
└─# ldd main
        linux-vdso.so.1 (0x00007ffe18b9d000)
        libc.so.6 => /home/glibc/lib/libc.so.6 (0x00007f1a6a9ec000)
        /home/glibc/lib/ld-linux-x86-64.so.2 => /lib64/ld-linux-x86-64.so.2 (0x00007f1a6abc6000)
```

libc和动态链接器都改好了



如果想要编译成32位程序

```
gcc main.c -o main -Wl,--rpath=/home/glibc32/lib -Wl,--dynamic-linker=/home/glibc32/lib/ld-linux.so.2   -I/home/glibc/include -g -no-pie -m32
```

```c
┌──(root㉿Destroyer)-[/home/glibc-test]
└─# ./main
Hello, world!

┌──(root㉿Destroyer)-[/home/glibc-test]
└─# ┌──(root㉿Destroyer)-[/home/glibc-test]
└─# file main
main: ELF 32-bit LSB executable, Intel 80386, version 1 (SYSV), dynamically linked, interpreter /home/glibc32/lib/ld-linux.so.2, BuildID[sha1]=c2629c0f00b91e2caa60e88d0d27198bc71ff49c, for GNU/Linux 3.2.0, with debug_info, not stripped

┌──(root㉿Destroyer)-[/home/glibc-test]
└─# ldd main
        linux-gate.so.1 (0xf7ef7000)
        libc.so.6 => /home/glibc32/lib/libc.so.6 (0xf7cd0000)
        /home/glibc32/lib/ld-linux.so.2 => /lib/ld-linux.so.2 (0xf7ef9000)
```

libc和动态链接器都改好了

此时使用gdb调试程序也是可以看到动态链接器的源码的

![image-20240813215802807](https://raw.githubusercontent.com/DeutschBall/VideoBed/main/image-20240813215802807.png)

也可以看到ld中的符号`link_map`

```c
pwndbg> info types link_map
All types matching regular expression "link_map":

File ../elf/link.h:
101:    struct link_map_public;

File ../include/link.h:
95:     struct link_map;
286:    struct link_map_reldeps;

File ../nptl_db/db_info.c:
40:     typedef struct link_map link_map;

File ../sysdeps/x86/linkmap.h:
10:     struct link_map_machine;
```





## patch-elf修改程序链接glibc

对于一个已经编译链接完毕,默认链接系统自带glibc的程序,如何让它使用我们编译的glibc呢

可以使用patch-elf修改程序，一是修改libc所在目录的位置，二是修改使用的链接器的绝对地址

```c
patchelf --set-rpath /home/glibc/lib/ --set-interpreter /home/glibc/lib/ld-linux-x86-64.so.2 main
```

```sh
┌──(root㉿Executor)-[/home/glibc-test]
└─# make main
gcc main.c -o main -no-pie -g -O0

┌──(root㉿Executor)-[/home/glibc-test]
└─# make ldd
ldd main
        linux-vdso.so.1 (0x00007fff8e1b2000)
        libc.so.6 => /lib/x86_64-linux-gnu/libc.so.6 (0x00007f02aebae000)
        /lib64/ld-linux-x86-64.so.2 (0x00007f02aedb3000)

┌──(root㉿Executor)-[/home/glibc-test]
└─# make patch
patchelf --set-rpath /home/glibc/lib/ --set-interpreter /home/glibc/lib/ld-linux-x86-64.so.2 main

┌──(root㉿Executor)-[/home/glibc-test]
└─# make ldd
ldd main
        linux-vdso.so.1 (0x00007fff70bfc000)
        libc.so.6 => /home/glibc/lib/libc.so.6 (0x00007f8ab9eef000)
        /home/glibc/lib/ld-linux-x86-64.so.2 => /lib64/ld-linux-x86-64.so.2 (0x00007f8aba126000)
        
┌──(root㉿Executor)-[/home/glibc-test]
└─# ./main
helloworld
```

改完了之后ldd观察结果和在编译链接时指定我们的glibc效果是一样的

虽然改完了ld的地址看上去还是指向原来那个`/home/glibc/lib/ld-linux-x86-64.so.2 => /lib64/ld-linux-x86-64.so.2`

但是调试观察实际上已经改过了

```
gef➤  info sharedlibrary 
From                To                  Syms Read   Shared Object Library
0x00007f5aff5a5000  0x00007f5aff5c8f91  Yes         /home/glibc/lib/ld-linux-x86-64.so.2
0x00007f5aff38f3c0  0x00007f5aff4d8c9d  Yes         /home/glibc/lib/libc.so.6
```







































