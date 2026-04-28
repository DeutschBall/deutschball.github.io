---
title: WSL2
date: 2022-06-23 22:44:00
# tags:
#   - linux
mathjax: true







---









# WSL2

Windows Subsystem for Linux,在windows上运行的linux子系统

前一段时间一直在用WSL kali+vscode+python3,做pwn的题目还有linux上的逆向题.确实比用vmware开一个虚拟机方便一万倍

但是对wsl的了解也就仅限于一些简单的命令比如`ls `等等,对于子系统和主系统的网络关系,以及子系统的其他用法,没有了解过

现在想了解一下子系统的结构,怎么用子系统完成操作系统的课程实验(编译内核,系统调用,内核模块,设备驱动)

以及如何修改子系统的各种设置,比如防火墙,与主机的网络关系,网络发现等

随性更新...

## 安装/卸载wsl

### 安装wsl

后面的实验都是基于WSL2已经安装完成,kali子系统已经能够在终端上运行了.安装wsl可以去微软官网(这部分已经被翻译过了),要添加windows功能

![image-20220622193653802](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220622193653802.png)

具体参考[WSL 的基本命令 | Microsoft Docs](https://docs.microsoft.com/zh-cn/windows/wsl/basic-commands)

在微软应用市场上可以下载各种linux系统,比如ubuntu18.04和ubuntu20.04,kali,debian等等

![image-20220622191626686](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220622191626686.png)



更方便的方法是在命令行上

**查看本机已安装子系统**

`wsl -l `

```powershell
PS C:\Users\86135\Desktop\pwn> wsl -l
适用于 Linux 的 Windows 子系统分发版:
kali-linux (默认)
Ubuntu
```



**查看可以安装的子系统**

`wsl -l -o`

```powershell
PS C:\Users\86135\Desktop\pwn> wsl -l -o
以下是可安装的有效分发的列表。
请使用“wsl --install -d <分发>”安装。

NAME            FRIENDLY NAME
Ubuntu          Ubuntu
Debian          Debian GNU/Linux
kali-linux      Kali Linux Rolling
openSUSE-42     openSUSE Leap 42
SLES-12         SUSE Linux Enterprise Server v12
Ubuntu-16.04    Ubuntu 16.04 LTS
Ubuntu-18.04    Ubuntu 18.04 LTS
Ubuntu-20.04    Ubuntu 20.04 LTS
```



**设置默认的wsl**

`wsl --set-default <子系统名>`

在powershell中使用wsl命令时,有一个默认使用的子系统,比如我现在默认使用kali-linux,当终端上直接输入wsl时默认唤醒kali-linux,而不是ubuntu

```
PS C:\Users\86135\Desktop\pwn> wsl --set-default ubuntu
PS C:\Users\86135\Desktop\pwn> wsl -l
适用于 Linux 的 Windows 子系统分发版:
Ubuntu (默认)
kali-linux
PS C:\Users\86135\Desktop\pwn> wsl --set-default kali-linux
PS C:\Users\86135\Desktop\pwn> wsl -l
适用于 Linux 的 Windows 子系统分发版:
kali-linux (默认)
Ubuntu
```

### 卸载子系统

在微软应用商店里是木法卸载子系统的,在终端上行

`wsl --unregister <子系统名>`



```powershell
PS C:\Users\86135\Desktop\pwn> wsl --unregister ubuntu
正在注销...
PS C:\Users\86135\Desktop\pwn> wsl -l
适用于 Linux 的 Windows 子系统分发版:
kali-linux (默认)
```

> 三炮!
>
> 出去!



## 唤醒/关闭wsl

### 选择唤醒哪一个子系统

`wsl -d <子系统名>`

```powershell
PS C:\Users\86135\Desktop\pwn> wsl -d ubuntu
ubuntu@Executor:/mnt/c/Users/86135/Desktop/pwn$
```



### 选择登录用户

`wsl -u <用户名>`

比如可以选择使用root登录系统,也可以使用普通用户登录系统.

只要是从powershell上唤醒子系统,不需要输入登录密码

```
PS C:\Users\86135\Desktop\pwn> wsl -u root
┏━(Message from Kali developers)
┃
┃ This is a minimal installation of Kali Linux, you likely
┃ want to install supplementary tools. Learn how:
┃ ⇒ https://www.kali.org/docs/troubleshooting/common-minimum-setup/
┃
┗━(Run: “touch ~/.hushlogin” to hide this message)
┌──(root㉿Executor)-[/mnt/c/Users/86135/Desktop/pwn]
└─# exit
logout
PS C:\Users\86135\Desktop\pwn> wsl -u kali
┏━(Message from Kali developers)
┃
┃ This is a minimal installation of Kali Linux, you likely
┃ want to install supplementary tools. Learn how:
┃ ⇒ https://www.kali.org/docs/troubleshooting/common-minimum-setup/
┃
┗━(Run: “touch ~/.hushlogin” to hide this message)
```

### 设置默认登录用户

kali的默认登录用户是普通用户,权限有限.现在想要将默认登录用户改成root,如此不需要su或者sudo再输入密码

`<子系统名> config --default-user <用户名>`

```powershell
PS C:\Users\86135\Desktop\pwn> kali config --default-user root
PS C:\Users\86135\Desktop\pwn> kali
┏━(Message from Kali developers)
┃
┃ This is a minimal installation of Kali Linux, you likely
┃ want to install supplementary tools. Learn how:
┃ ⇒ https://www.kali.org/docs/troubleshooting/common-minimum-setup/
┃
┗━(Run: “touch ~/.hushlogin” to hide this message)
┌──(root㉿Executor)-[~]
└─#
```



### 查看子系统内核版本`wsl --status`

```powershell
PS C:\Users\86135\Desktop\pwn> wsl --status
默认分发：kali-linux
默认版本：2

适用于 Linux 的 Windows 子系统最后更新于 2022/4/21
适用于 Linux 的 Windows 子系统内核可以使用“wsl --update”手动更新，但由于你的系统设置，无法进行自动更新。
 若要接收自动内核更新，请启用 Windows 更新设置:“在更新 Windows 时接收其他 Microsoft 产品的更新”。
 有关详细信息，请访问https://aka.ms/wsl2kernel。
Windows 更新已暂停。

内核版本： 5.10.102.1
```

### 子系统关机

关闭子系统所在的终端并不会关闭wsl,它会在后台运行,因此下一次打开wsl的时候会发现开启的很快.

在powershell上使用`wsl --shutdown`就可以关闭所有在后台运行的子系统

如果不想关闭所有后台子系统,只停止其中的某一个,可以`wsl --terminate <子系统名>`



## 工作目录



### windows下wsl的位置

`\\wsl.localhost\kali-linux`

```powershell
PS Microsoft.PowerShell.Core\FileSystem::\\wsl.localhost\kali-linux> pwd

Path
----
Microsoft.PowerShell.Core\FileSystem::\\wsl.localhost\kali-linux
```

这到底是个啥地方呢?前面怎么好长一坨,FileSystem后面还有俩冒号

```powershell
PS C:\Users\86135> cd \\wsl.localhost\kali-linux
PS Microsoft.PowerShell.Core\FileSystem::\\wsl.localhost\kali-linux>
```

如果在这个目录下面,想使用cd ..退到爹目录,接着说找不到爹目录

实际上可以直接用explorer访问wsl的文件系统

![image-20220716105512580](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220716105512580.png)











### wsl上windows的位置

```bash
┌──(root㉿Executor)-[/mnt/c/Users/86135/Desktop/pwn]
└─# pwd
/mnt/c/Users/86135/Desktop/pwn
```

即windows的根目录在wsl上为`/mnt/`

比如桌面就是`/mnt/c/Users/86135/Desktop/`

D盘就是`/mnt/d/`



## 共享环境变量

在wsl上可以调用windows的环境变量中的应用程序

不同于windows终端的是,wsl上调用win的应用需要.exe后缀

```bash
┌──(root㉿Executor)-[~]
└─# ipconfig
-bash: ipconfig: command not found

┌──(root㉿Executor)-[~]
└─# ipconfig.exe

Windows IP 配置


以太网适配器 以太网:

   媒体状态  . . . . . . . . . . . . : 媒体已断开连接
   ...
```

也可以用wsl打开主系统中已经添加到环境变量的窗口应用程序



也可以在wsl上调用主系统的cmd,切换到主系统的cmd终端

```bash
┌──(root㉿Executor)-[~]
└─# cmd.exe
'\\wsl.localhost\kali-linux\root'
用作为当前目录的以上路径启动了 CMD.EXE。
UNC 路径不受支持。默认值设为 Windows 目录。
Microsoft Windows [版本 10.0.22000.675]
(c) Microsoft Corporation。保留所有权利。

C:\Windows>
```



至于两个系统的终端怎么怎么联系.

这都是茴香豆的n种写法,不会有人闲的让终端之间踢皮球吧

并且还有设置开关这些功能,我寻思多多益善吧,不冲突关他干啥呢







## wsl执行linux命令

正常情况下,linux上的可执行程序.elf或者.out,在windows上是没法执行的.同理win上的.exe也无法在linux上执行

而wsl就提供了一种在windows上执行linux可执行目标文件的方法



```shell
用法: wsl.exe [参数] [选项...] [命令行]

运行 Linux 二进制文件的参数:

    如果未提供命令行，wsl.exe 将启动默认 shell。

    --exec, -e <命令行>
        在不使用默认 Linux Shell 的情况下执行指定的命令。

    --
        按原样传递其余命令行。
```

比如

```shell
PS C:\Users\86135\Desktop\pwn> ls -l
Get-ChildItem : 缺少参数“LiteralPath”的某个参数。请指定一个类型为“System.String[]”的参数，然后再试一次。
所在位置 行:1 字符: 4
+ ls -l
+    ~~
    + CategoryInfo          : InvalidArgument: (:) [Get-ChildItem]，ParameterBindingException
    + FullyQualifiedErrorId : MissingArgument,Microsoft.PowerShell.Commands.GetChildItemCommand

PS C:\Users\86135\Desktop\pwn> wsl ls -l
total 108
drwxrwxrwx 1 kali kali  4096 Jun  2 19:52 CGfsb
drwxrwxrwx 1 kali kali  4096 May 19 23:14 cgpwn
drwxrwxrwx 1 kali kali  4096 Jun 20 09:55 dice_game
drwxrwxrwx 1 kali kali  4096 Jun 19 23:09 forgot
drwxrwxrwx 1 kali kali  4096 May 11 17:45 get_shell
drwxrwxrwx 1 kali kali  4096 May 20 09:28 guess_num
drwxrwxrwx 1 kali kali  4096 May 11 09:51 hello_pwn
drwxrwxrwx 1 kali kali  4096 May 20 08:45 int_overflow
drwxrwxrwx 1 kali kali  4096 May 11 17:38 level0
drwxrwxrwx 1 kali kali  4096 May 11 21:08 level2
drwxrwxrwx 1 kali kali  4096 Jun  3 16:27 level3
drwxrwxrwx 1 kali kali  4096 Jun 21 10:30 mytest
-rwxrwxrwx 1 kali kali 84286 Jun  3 16:10 pwn.md
drwxrwxrwx 1 kali kali  4096 Jun 19 23:38 reactor
drwxrwxrwx 1 kali kali  4096 Jun 20 00:28 realtime
drwxrwxrwx 1 kali kali  4096 Jun 20 10:06 stack2
drwxrwxrwx 1 kali kali  4096 Jun  3 10:56 string
drwxrwxrwx 1 kali kali  4096 May 29 16:03 testPIE
```

在输入`wsl ls -l`命令之后终端等了好长时间去了,推测是启动子系统去了.

估计这个过程就是在子系统上运行了`ls -l`命令之后,将结果反馈给powershell,然后powershell打印到屏幕上



## 高级配置

wsl上两个配置文件`wsl.conf` `.wslconfig`

微软给出的这两个文件的描述

>  **wsl.conf**
>
> - 作为 unix 文件存储在 `/etc` 分发目录中。
> - 用于按分布配置设置。 在此文件中配置的设置将仅应用于包含存储此文件的目录的特定 Linux 分发版。
> - 可用于版本、WSL 1 或 WSL 2 运行的分发版。
> - 若要访问已安装的发行版的 `/etc` 目录，请使用发行版的命令行和 `cd /` 访问根目录，然后使用 `ls` 列出文件或使用 `explorer.exe .` 在 Windows 文件资源管理器中查看。 目录路径应如下所示： `/etc/wsl.conf`
>
>  **.wslconfig**
>
> - 存储在 `%UserProfile%` 目录中。
> - 用于全局配置作为 WSL 2 版本运行的所有已安装 Linux 分发版的设置。
> - 仅适用于 **WSL 2 运行的分发**版。 作为 WSL 1 运行的分发版不会受到此配置的影响，因为它们未作为虚拟机运行。
> - 要访问 `%UserProfile%` 目录，请在 PowerShell 中使用 `cd ~` 访问主目录（通常是用户配置文件 `C:\Users\<UserName>`），或者可以打开 Windows 文件资源管理器并在地址栏中输入 `%UserProfile%`。 目录路径应如下所示： `C:\Users\<UserName>\.wslconfig`

这两个文件在默认情况下是不存在的,只有我们需要修改wsl的参数时,才需要在相应位置建立这么一个文件.

`wsl`再启动时就会考虑这些文件里的规定了



`wsl.conf`放在子系统里

`.wslconfig`放在主系统里.

在使用wmware的时候,我们可以自由决定虚拟机占用多大内存,最多使用多少个处理器,这就是`.wslconfig`的作用

在修改之前,首先在wsl上观察一下处理器数量

```bash
┌──(root㉿Executor)-[/mnt/c/Users/86135]
└─# cat /proc/cpuinfo | grep name | cut -f2 -d: | uniq -c
     16  11th Gen Intel(R) Core(TM) i7-11800H @ 2.30GHz
```

wsl显示有16个,现在修改`.wslconfig`给他改成8个

观察一下总内存大小

```bash
┌──(root㉿Executor)-[/mnt/c/Users/86135]
└─# cat /proc/meminfo | grep MemTotal
MemTotal:       16262436 kB
```

现在修改`.wslconfig`文件,调整上面两个值

`C:\Users\86135\.wslconfig`

```powershell
# Settings apply across all Linux distros running on WSL 2
[wsl2]			#正文第一行必须是[wsl2]这种标记

# Limits VM memory to use no more than 4 GB, this can be set as whole numbers using GB or MB
memory=4GB 	#限制内存最大4G
	
# Sets the VM to use two virtual processors
processors=8		#设置8个处理器
```

调整后保存,子系统重启,再打印观察

```bash
┌──(root㉿Executor)-[~]
└─# cat /proc/meminfo | grep MemTotal
MemTotal:        4017200 kB

┌──(root㉿Executor)-[~]
└─# cat /proc/cpuinfo | grep name | cut -f2 -d: | uniq -c
      8  11th Gen Intel(R) Core(TM) i7-11800H @ 2.30GHz
```

发现刚才的修改确实奏效了



## 换下载源

首先备份原来的源

```bash
┌──(root㉿Executor)-[~]
└─# mv /etc/apt/sources.list /etc/apt/sources.list.bak
```

将该文件修改为阿里云的源

```
deb https://mirrors.aliyun.com/kali kali-rolling main non-free contrib
deb-src https://mirrors.aliyun.com/kali kali-rolling main non-free contrib
```

修改之后可以`apt update`看看成功没

```bash
┌──(root㉿Executor)-[~]
└─# vim /etc/apt/sources.list

┌──(root㉿Executor)-[~]
└─# apt update
Get:1 https://mirrors.aliyun.com/kali kali-rolling InRelease [30.6 kB]
Get:2 https://mirrors.aliyun.com/kali kali-rolling/main Sources [14.7 MB]
Get:3 https://mirrors.aliyun.com/kali kali-rolling/non-free Sources [128 kB]
Get:4 https://mirrors.aliyun.com/kali kali-rolling/contrib Sources [73.1 kB]
Get:5 https://mirrors.aliyun.com/kali kali-rolling/main amd64 Packages [18.4 MB]
Get:6 https://mirrors.aliyun.com/kali kali-rolling/non-free amd64 Packages [213 kB]
Get:7 https://mirrors.aliyun.com/kali kali-rolling/contrib amd64 Packages [116 kB]
Fetched 33.6 MB in 22s (1,505 kB/s)
Reading package lists... Done
Building dependency tree... Done
Reading state information... Done
257 packages can be upgraded. Run 'apt list --upgradable' to see them.
```





## 设置代理

找个好地方`vim bash_profile`

```
export http_proxy=http://172.25.144.1:7891/
export https_proxy=http://172.25.144.1:7891/
```

这里172.25.144.1是我windows本机的wsl网卡地址,这玩意儿可以在`/etc/resolv.conf`查看

```
┌──(root㉿Executor)-[/home]
└─# cat /etc/resolv.conf
# This file was automatically generated by WSL. To stop automatic generation of this file, add the following entry to /etc/wsl.conf:
# [network]
# generateResolvConf = false
nameserver 172.25.144.1
```

端口号为啥是7891呢,因为我本机clash在7891上开的代理端口

注意clash开允许局域网,系统代理

![image-20240321233234943](https://raw.githubusercontent.com/DeutschBall/picbed/main/image-20240321233234943.png)

写完了bash_profile之后保存退出,然后`source bash_profile`

**这样对于本终端就已经更换了代理,重新开机或者打开其他终端都没有此设置**













## wsl迁移

kali-linux迁移前的C卷大小

![image-20220716102545759](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220716102545759.png)

由于我想为kali安装一个xfce桌面,KDE桌面很大,又要剥削压迫C卷,于是就像把wsl搬到D卷

先用安装了python3的ubuntu20.04LTS做了一个实验,结果迁移后的ubuntu还是有python3的,这意味着以前的修改都会保留

kali-linux迁移过程:

### 1.wsl关机

```
wsl --shutdown
```

### 2.选好目的地

我将D:\wsl\kali作为目的地,加一个wsl父目录是因为,同父目录下还有D:\wsl\ubuntu子系统,将powershell的当前工作目录调整到D:\wsl\kali

```powershell
PS D:\wsl\kali> pwd

Path
----
D:\wsl\kali
```

### 3.选择需要导出的子系统

使用`wsl -l`指令列出所有已经注册的子系统名

```powershell
PS D:\wsl\kali> wsl -l
适用于 Linux 的 Windows 子系统分发版:
kali-linux (默认)
ubuntu
```

### 4.导出`kali-linux.tar`

```
wsl --export <子系统名> <tar包路径>
```

```c
PS D:\wsl\kali> wsl --export kali-linux ./kali.tar
```

本条命令的意义是,将名为kali-linux的子系统,导出到当前工作目录下的kali.tar中

### 5.卸载本来安装在C卷的kali-linux

```
wsl --unregister <子系统名>
```

```c
PS D:\wsl\kali> wsl --unregister kali-linux
正在注销...
```

### 6.导入迁移到D卷的kali-linux

```
wsl --import <子系统名> <子系统安装路径> <tar包路径>
```

```powershell
PS D:\wsl\kali> wsl --import kali-linux . ./kali.tar
```

本条命令的意义是,从当前目录的kali.tar包导入子系统到当前目录,子系统名叫kali-linux

### 7.验证导出成功

终端启动kali成功

![image-20220716103913136](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220716103913136.png)





虽然迁移kali只给C省出了3G的磁盘空间...

![image-20220716103955718](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220716103955718.png)

但是可以放心安装桌面了

## 安装桌面

在此之前需要保证wsl升级到wsl2,换下载源到阿里云(如果梯子流量管够忽略)

### 安装Win-KeX

> Win-KeX是windows为kali专门提供的桌面体验,具有以下功能
>
> - 窗口模式：在专用窗口中启动Kali Linux桌面
> - 无缝模式：在Windows和Kali应用程序和菜单之间共享Windows桌面
> - 声音支持
> - 无特权和根会话支持
> - 共享剪贴板，可在Kali Linux和Windows应用之间进行剪切和粘贴支持
> - 多会话支持：根窗口和非私有窗口以及无缝会话同时进行

安装之前先`apt update`更新一下

之后安装Win-KeX

```
apt install -y kali-win-kex
```

安装可能很慢...但是速度是百度云盘两倍(比烂是吧)

![image-20220716104931612](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220716104931612.png)



安装完成后在kali上使用kex命令,输入一些密码之后,就可以使用xfce桌面了

![image-20220716114030667](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220716114030667.png)

在kex中使用F8键可以选择桌面以windows窗口运行还是全屏运行,

全屏时就和真的kali系统没有区别了,所有键鼠命令都会被kali捕获,不会发往windows

F8的fullscreen可以设置窗口或者全屏模式



## 完整everything

一开始安装的子系统只是最小安装,只安装了一个系统,各种武器都没有安装

kali子系统完整安装

```
apt install kali-linux-everything
```

大约有20个G,还是在学校wifi环境下安装吧,使用流量划不来



## ida+wsl远程调试

终于会动态调试了

但是windows上的IDA似乎只能用local windows debugger,其他的各种各样的设置看了就烦

今天终于不厌其烦试了试IDA+remote linux debugger在ida上调试elf文件

终于调通了

需要ida,wsl

### remote linux debugger

win11+wsl kali+ida

`IDA-<version>/dbgsrv/`这个目录下面有调试需要使用的文件

![image-20220901163211166](https://raw.githubusercontent.com/DeutschBall/DeutschBall/main/image-20220901163211166.png)

如果要使用linux远程调试elf文件,需要linux_server和linux_server64两个文件,把他俩复制到kali的文件系统中去

```shell
┌──(root㉿Executor)-[/home/kali]
└─# ls -l | grep linux
-rwxrwxrwx 1 root root 783792 Jan  1  2021 linux_server
-rwxrwxrwx 1 root root 735376 Jan  1  2021 linux_server64
```

cd 到该目录下,修改其权限

可以使用--help看linux_server的用法

```
chmod 777 linux_server
```

```shell
┌──(root㉿Executor)-[/home/kali]
└─# ./linux_server --help
IDA Linux 32-bit remote debug server(ST) v7.5.26. Hex-Rays (c) 2004-2020
Usage: linux_server [options]
  -p ...  (--port-number ...) Port number
  -i ...  (--ip-address ...) IP address to bind to (default to any)
  -s      (--use-tls) Use TLS
  -c ...  (--certchain-file ...) TLS certificate chain file
  -k ...  (--privkey-file ...) TLS private key file
  -v      (--verbose) Verbose mode
  -P ...  (--password ...) Password
  -k      (--on-broken-connection-keep-session) Keep debugger session alive when connection breaks
  -K      (--on-stop-kill-process) Kill debuggee when closing session

```

执行linux_server

```shell
┌──(root㉿Executor)-[/home/kali]
└─# ./linux_server
IDA Linux 32-bit remote debug server(ST) v7.5.26. Hex-Rays (c) 2004-2020
Listening on 0.0.0.0:23946...
```

此时kali已经在监听其23946端口了

现在用ida打开一个32位elf程序,F9或者点击Debugger下拉菜单,选择调试器Remote Linux debugger

![image-20220901163954709](https://raw.githubusercontent.com/DeutschBall/DeutschBall/main/image-20220901163954709.png)

然后调试运行(ida默认也是访问远程主机的23946端口,如果不是则这里肯定联不通,ida会让重新设置端口的)

必然会报错找不到输入文件,

![image-20220901164111650](https://raw.githubusercontent.com/DeutschBall/DeutschBall/main/image-20220901164111650.png)

一看报错信息,原来输入文件是从远程linux上找的,当然找不到

OK之后ida提供了替代方案

![image-20220901164214375](https://raw.githubusercontent.com/DeutschBall/DeutschBall/main/image-20220901164214375.png)

点这个Use found就可以使用本机的`C:\Users\86135\Desktop\malloc\main`作为输入文件了

但是调试界面刚出来又没了,原来是忘记下断点了

在main函数(或者其他地方)下断点,然后重新调试运行,可以调试了

![image-20220901164532437](https://raw.githubusercontent.com/DeutschBall/DeutschBall/main/image-20220901164532437.png)



甚至可以使用F5反汇编,显然是linux上的光棍儿gdb做不到的



### remote gbd debugger

既然linux上也有gdb,那么是不是也可以用远程gdb调试呢?确实能调通,安一个gdbserver剩下的随便拾到拾到就行了

```
apt install gdbserver
```



/usr/src/WSL2-Linux-Kernel-linux-msft-wsl-5.15.137.3/arch/x86/boot/bzImage

## 编译内核

如果用普通的linux内核直接编译,然后给wsl换这个普通内核,这样wsl起不来

编译wsl内核需要有专门的config文件

内核源码可以用原版的,比如到这里下载[Index of /pub/linux/kernel/v5.x/](https://mirrors.edge.kernel.org/pub/linux/kernel/v5.x/)

以5.8.13为例,

```
wget https://mirrors.edge.kernel.org/pub/linux/kernel/v5.x/linux-5.8.13.tar.gz
tar -xzf linux-5.8.13.tar.gz
cd linux-5.8.13
```

然后在内核源码的根目录下

```
mkdir Microsoft
cd Microsoft
vim config-wsl
```

这玩意儿可以抄[WSL2-Linux-Kernel/Microsoft/config-wsl at wsl-xyb-port-5.8.y-latest · xieyubo/WSL2-Linux-Kernel · GitHub](https://github.com/xieyubo/WSL2-Linux-Kernel/blob/wsl-xyb-port-5.8.y-latest/Microsoft/config-wsl),注意版本,5.8的内核就得抄5.8的config_wsl,直接复制粘贴

可以修改其中的`CONFIG_LOCALVERSION`,改成自定义内核名称后缀

完事之后退到内核源码根目录下

```sh
make KCONIFG_CONFIG=./Microsoft/config-wsl -j`nproc`
```

编译完了之后会生成./arch/x86/boot/bzImage,这就是可以引导的内核

可以安装头文件

```
make modules_install
```











## 更换内核

### 默认配置

如果没有在~/.wslconfig中修改内核位置,那么可以这样整:

编译内核完成后,将生成的bzImage可引导镜像放到本机的`C:\Windows\System32\lxss\tools`这个位置

`wsl --shutdown`

在`C:\Windows\System32\lxss\tools`中,将之前的内核镜像kernel改个名,比如oldkernel

然后将刚搬过来的bzImage改成kernel

重启wsl

`uname -a`查看当前内核版本

```
┌──(root㉿Executor)-[/home/dustball/kernelROP/mydev]
└─# uname -a
Linux Executor 5.8.13-dustland #1 SMP Sun Mar 24 13:56:15 CST 2024 x86_64 GNU/Linux
```



### 指定kernel位置

比如在windows的`~/.wslconfig`中这样写

```sh
# Settings apply across all Linux distros running on WSL 2
[wsl2]
kernel=C:\\opt\\kernel
# Limits VM memory to use no more than 4 GB, this can be set as whole numbers using GB or MB
memory=4GB      #限制内存最大4G

# Sets the VM to use two virtual processors
processors=8            #设置8个处理器

# vmSwitch=vEthernet

# networkingMode=bridged
# vmSwitch=WSL
# ipv6=true

```

这就指定了wsl内核使用`c:\\opt\\kernel`









## 编译内核模块

需要更滑内核

编译内核模块需要内核头文件,

如果已经编译过wsl内核,并且`make modules_install && make install`,那么就可以直接编译内核模块了

如果没有编译过内核,需要先编译内核



假设内核模块hello.c这样写

```c
// hello.c
#include <linux/init.h>
#include <linux/module.h>
#include <linux/kernel.h>
#include <linux/moduleparam.h>

MODULE_LICENSE("GPL");

static int __init mod_init(void)
{
    printk(KERN_ALERT "Hello world\n");
    return 0;
}

static void __exit mod_exit(void)
{
    printk(KERN_ALERT "Goodbye\n");
}

module_init(mod_init);
module_exit(mod_exit);
```

它的Makefile这样写

```makefile
# Makefile
KDIR = /lib/modules/5.15.137.3/
TARGETNAME = hello
OBJ        = $(TARGETNAME).o
MODULE     = $(TARGETNAME).ko
obj-m += $(OBJ)

all:
		make -j $(nproc) -C $(KDIR)/build M=$(PWD) modules

install:
		@modprobe -r $(TARGETNAME)
		@install $(MODULE) $(KDIR)3/kernel/drivers/hid
		@depmod
		@modprobe $(TARGETNAME)
clean:
		make -C $(KDIR)/build M=$(PWD) clean
```

KDIR这个自己写,通常是`/lib/modules/$(shell uname -r)`

```
make
```

之后在当前目录下生成hello.ko

加载到内核

```
insmod hello.ko
```









