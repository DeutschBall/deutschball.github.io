---
title: ELF
date: 2022-08-08 15:14:00
tags: 程序员的自我修养
mathjax: true
---
# ELF

可以先看CSAPP chapter 7链接然后看程序员自我修养 chapter 3

## 历史与简介

> 一个程序的编译链接全过程
>
> ![](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220805144230118.png)

**分类:**

目标文件可以分为两种,可重定位目标文件,和可执行目标文件

其中可重定位目标模块在linux上是.o,在windows上是.obj.源代码只经过编译,不通过链接得到可重定位目标模块.其中的代码数据从0开始编址,只具有相对意义,无绝对意义

一个或者多个可重定位目标模块,与库文件链接后,形成可执行目标文件,在windows上是.exe,在linux上是.out

库文件,包括动态库和静态库,也是按照目标文件的结构存储的

> COFF分类
>
> ![image-20220805145133735](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220805145133735.png)

**历史:**

最初Unix上的可执行文件格式为COFF(common file format)

从Unix进化而来的Windows,Linux分别有不同的变种

Windows NT上是PE-COFF(portable executable)

Linux上是ELF(Executable Linkable Format)

## Linux ELF格式

![ELF](https://raw.githubusercontent.com/DeutschBall/test/master/ELF.png)

![image-20220805153055752](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220805153055752.png)

linux源码中ELF格式定义在 `elf.h`中

```c
┌──(root㉿Executor)-[/mnt/c/Users/86135/desktop/COFF]
└─# whereis elf.h
elf.h: /usr/include/elf.h
```

关于该 `elf.h`中的基本数据类型,没有直接使用诸如 `int,char`等类型,而是使用 `typedef`重新包装了一下

![image-20220805154752930](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220805154752930.png)

就一个Half类型需要注意,不管是32位系统还是64位系统上该值都是2字节

### ELF头

使用 `readelf -h main`即可观察elf头

```shell
┌──(root㉿Executor)-[/mnt/c/Users/86135/desktop/COFF]
└─# readelf -h main
ELF Header:
  Magic:   7f 45 4c 46 02 01 01 00 00 00 00 00 00 00 00 00
  Class:                             ELF64
  Data:                              2's complement, little endian
  Version:                           1 (current)
  OS/ABI:                            UNIX - System V
  ABI Version:                       0
  Type:                              DYN (Position-Independent Executable file)
  Machine:                           Advanced Micro Devices X86-64
  Version:                           0x1
  Entry point address:               0x1040
  Start of program headers:          64 (bytes into file)
  Start of section headers:          14080 (bytes into file)
  Flags:                             0x0
  Size of this header:               64 (bytes)
  Size of program headers:           56 (bytes)
  Number of program headers:         13
  Size of section headers:           64 (bytes)
  Number of section headers:         30
  Section header string table index: 29
```

64位elf头格式:

```c
#define EI_NIDENT (16)

typedef struct
{
  unsigned char	e_ident[EI_NIDENT];	/* Magic number and other info */
  Elf64_Half	e_type;			/* Object file type */
  Elf64_Half	e_machine;		/* Architecture */
  Elf64_Word	e_version;		/* Object file version */
  Elf64_Addr	e_entry;		/* Entry point virtual address */
  Elf64_Off	e_phoff;		/* Program header table file offset */
  Elf64_Off	e_shoff;		/* Section header table file offset */
  Elf64_Word	e_flags;		/* Processor-specific flags */
  Elf64_Half	e_ehsize;		/* ELF header size in bytes */
  Elf64_Half	e_phentsize;		/* Program header table entry size */
  Elf64_Half	e_phnum;		/* Program header table entry count */
  Elf64_Half	e_shentsize;		/* Section header table entry size */
  Elf64_Half	e_shnum;		/* Section header table entry count */
  Elf64_Half	e_shstrndx;		/* Section header string table index */
} Elf64_Ehdr;
```

#### e_ident

整个ELF文件开头的十六个无符号字符类型,作用是表征文件魔数以及其他信息

`7F 45 4C 46 02 01 01 00 00 00 00 00 00 00 00 00`

> 前16个字节翻译成人话:4位 ELF version1 小端存储文件

![image-20220805153933915](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220805153933915.png)

这16个字符分别代表的信息在 `elf.h`中给出了宏定义

```c

/* Fields in the e_ident array.  The EI_* macros are indices into the
   array.  The macros under each EI_* macro are the values the byte
   may have.  */

#define EI_MAG0		0		/* File identification byte 0 index */
#define ELFMAG0		0x7f		/* Magic number byte 0 */

#define EI_MAG1		1		/* File identification byte 1 index */
#define ELFMAG1		'E'		/* Magic number byte 1 */

#define EI_MAG2		2		/* File identification byte 2 index */
#define ELFMAG2		'L'		/* Magic number byte 2 */

#define EI_MAG3		3		/* File identification byte 3 index */
#define ELFMAG3		'F'		/* Magic number byte 3 */

/* Conglomeration of the identification bytes, for easy testing as a word.  */
#define	ELFMAG		"\177ELF"
#define	SELFMAG		4

#define EI_CLASS	4		/* File class byte index */
#define ELFCLASSNONE	0		/* Invalid class */
#define ELFCLASS32	1		/* 32-bit objects */
#define ELFCLASS64	2		/* 64-bit objects */
#define ELFCLASSNUM	3
....
```

##### 前四字符 `e_ident[EI_MAG0]~e_ident[EI_MAG3]`

```c
#define EI_MAG0		0		/* File identification byte 0 index */
#define ELFMAG0		0x7f		/* Magic number byte 0 */

#define EI_MAG1		1		/* File identification byte 1 index */
#define ELFMAG1		'E'		/* Magic number byte 1 */

#define EI_MAG2		2		/* File identification byte 2 index */
#define ELFMAG2		'L'		/* Magic number byte 2 */

#define EI_MAG3		3		/* File identification byte 3 index */
#define ELFMAG3		'F'		/* Magic number byte 3 */
```

前四个字符 `7F454C46`的ASCII码是 ` [DEL]ELF`,ELF魔数前面有一个DEL删除符,不是ASCII可打印字符

```c
/* Conglomeration of the identification bytes, for easy testing as a word.  */
#define	ELFMAG		"\177ELF"
#define	SELFMAG		4
```

##### 第五个字符 `e_ident[EI_CLASS]`

```c
#define EI_CLASS	4		/* File class byte index */
#define ELFCLASSNONE	0		/* Invalid class */
#define ELFCLASS32	1		/* 32-bit objects */
#define ELFCLASS64	2		/* 64-bit objects */
```

0表示无效elf文件

1表示32位elf文件

2表示64位elf文件

##### 第六个字符 `e_ident[EI_DATA]`

```c
#define EI_DATA		5		/* Data encoding byte index */
#define ELFDATANONE	0		/* Invalid data encoding */
#define ELFDATA2LSB	1		/* 2's complement, little endian */
#define ELFDATA2MSB	2		/* 2's complement, big endian */
```

规定数据大小端顺序

0无效格式

1小端格式

2大端格式

##### 第七个字符 `e_ident[EI_VERSION]`

```c
#define EI_VERSION	6		/* File version byte index */
					/* Value must be EV_CURRENT */
```

```c
/* Legal values for e_version (version).  */

#define EV_NONE		0		/* Invalid ELF version */
#define EV_CURRENT	1		/* Current version */
```

注释中写道,该值必须为 `EV_CURRENT(1)`

其意义是ELF的主版本号,为啥一定是1呢?

因为ELF最新版本是1.2,之后没有更新,因此最新版本也就是先行版本,就是1

后面9个字符elf标准没有要求,一般置0,但是elf.h中是有意义的

##### 第八个字符 `e_ident[EI_OSABI]`

```c
#define EI_OSABI	7		/* OS ABI identification */
#define ELFOSABI_NONE		0	/* UNIX System V ABI */
#define ELFOSABI_SYSV		0	/* Alias.  */
#define ELFOSABI_HPUX		1	/* HP-UX */
#define ELFOSABI_NETBSD		2	/* NetBSD.  */
#define ELFOSABI_GNU		3	/* Object uses GNU ELF extensions.  */
#define ELFOSABI_LINUX		ELFOSABI_GNU /* Compatibility alias.  */
#define ELFOSABI_SOLARIS	6	/* Sun Solaris.  */
#define ELFOSABI_AIX		7	/* IBM AIX.  */
#define ELFOSABI_IRIX		8	/* SGI Irix.  */
#define ELFOSABI_FREEBSD	9	/* FreeBSD.  */
#define ELFOSABI_TRU64		10	/* Compaq TRU64 UNIX.  */
#define ELFOSABI_MODESTO	11	/* Novell Modesto.  */
#define ELFOSABI_OPENBSD	12	/* OpenBSD.  */
#define ELFOSABI_ARM_AEABI	64	/* ARM EABI */
#define ELFOSABI_ARM		97	/* ARM */
#define ELFOSABI_STANDALONE	255	/* Standalone (embedded) application */
```

OS ABI identification,操作系统 应用 二进制 接口 标识

> 关于ABI,参考了[你们说的ABI，Application Binary Interface到底是什么东西？ - 知乎 (zhihu.com)](https://www.zhihu.com/question/381069847)
>
> 关键点:
>
> **ABI实际上讨论的是什么?**
>
> 那么当人们提到 ABI 的时候，到底在说什么？以我个人的经验来看，当人们提及 ABI 时，一般主要是在说 Binary-compatible 即二进制兼容性。
>
> **什么是二进制兼容性?**
>
> 一个库在 VC9 上完成编译并以 DLL 形式发布，如果该库要求使用它的应用程序也必须在 VC9 上编译，那么说这个库不是二进制兼容的；反之，如果任意版本的 VC 乃至其它编译器例如 gcc、clang 都可以使用这个库，那么说这个库是二进制兼容的。
>
> 二进制兼容性包括调用约定,命名管理

> ABI（Application Binary Interface）：应用程序二进制接口，描述了应用程序和操作系统之间，一个应用和它的库之间，或者应用的组成部分之间的低接口。ABI涵盖了各种细节，如：
>
> - 数据类型的大小、布局和对齐；
> - 调用约定（控制着函数的参数如何传送以及如何接受返回值），例如，是所有的参数都通过栈传递，还是部分参数通过寄存器传递；哪个寄存器用于哪个函数参数；通过栈传递的第一个函数参数是最先push到栈上还是最后；
> - [系统调用](https://baike.baidu.com/item/系统调用)的编码和一个应用如何向操作系统进行系统调用；
> - 以及在一个完整的操作系统ABI中，[目标文件](https://baike.baidu.com/item/目标文件)的[二进制](https://baike.baidu.com/item/二进制/361457)格式、程序库等等。

`ELFOSABI_NONE(0)`表明本文件满足 `UNIX System V ABI`规范,已成为主要的Unix操作系统（例如Linux，BSD系统和许多其他操作系统）使用的标准ABI

> 那么调用约定就得查UNIX System V,查stdcall,fastcall,cdecl等等没有没用
>
> ![](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220428152425649.png)

##### 第九个字符 `e_ident[EI_ABIVERSION]`

ABI版本号,然而实际上都是0

##### 剩下七个字符

全是~~胸垫~~,目前没有作用

```
#define EI_PAD		9		/* Byte index of padding bytes */
```

#### e_type

目标文件类型,区分库文件,可重定位目标模块,可执行目标文件等等

```c
/* Legal values for e_type (object file type).  */

#define ET_NONE		0		/* No file type */
#define ET_REL		1		/* Relocatable file 可重定位.o文件*/
#define ET_EXEC		2		/* Executable file 可执行.out文件*/
#define ET_DYN		3		/* Shared object file 动态库.so文件*/
#define ET_CORE		4		/* Core file 核心文件*/
```

#### e_machine

```c

/* Legal values for e_machine (architecture).  */

#define EM_NONE		 0	/* No machine */
#define EM_M32		 1	/* AT&T WE 32100 */
#define EM_SPARC	 2	/* SUN SPARC */
#define EM_386		 3	/* Intel 80386 */
#define EM_68K		 4	/* Motorola m68k family */
#define EM_88K		 5	/* Motorola m88k family */
#define EM_IAMCU	 6	/* Intel MCU */
#define EM_860		 7	/* Intel 80860 */
#define EM_MIPS		 8	/* MIPS R3000 big-endian */
#define EM_S370		 9	/* IBM System/370 */
#define EM_MIPS_RS3_LE	10	/* MIPS R3000 little-endian */
...
#define EM_X86_64	62	/* AMD x86-64 architecture */
...
#define EM_NUM		253
```

`e_machine`的有效值总共有253个,每一个代表一种机器类型

可执行目标文件 `main`中该值为 `EM_X86_64(62)`,意思是本程序只能在x86_64体系上执行,

在x86_32上或者MIPS等等都不行

#### e_version

elf版本号,有效值只有1,也就是先行ELF文件版本,作用和 `e_ident[EI_VERSION]`相同

```c
/* Legal values for e_version (version).  */

#define EV_NONE		0		/* Invalid ELF version */
#define EV_CURRENT	1		/* Current version */
```

#### e_entry

ELF文件的入口点,如果没有入口点,比如库文件,则该值默认为0

main文件中该值为 `0x1040`

![image-20220805164912919](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220805164912919.png)

本文件开始运行后,操作系统将控制转移给该位置的指令

用ida64打开main按下g跳转0x1040,发现是 `start`的RVA(虚拟内存相对偏移量)地址

```asm
.text:0000000000001040                 public start
.text:0000000000001040 start           proc near               ; DATA XREF: LOAD:0000000000000018↑o
.text:0000000000001040 ; __unwind {
.text:0000000000001040                 xor     ebp, ebp
.text:0000000000001042                 mov     r9, rdx         ; rtld_fini
.text:0000000000001045                 pop     rsi             ; argc
.text:0000000000001046                 mov     rdx, rsp        ; ubp_av
.text:0000000000001049                 and     rsp, 0FFFFFFFFFFFFFFF0h
.text:000000000000104D                 push    rax
.text:000000000000104E                 push    rsp             ; stack_end
.text:000000000000104F                 lea     r8, __libc_csu_fini ; fini
.text:0000000000001056                 lea     rcx, __libc_csu_init ; init
.text:000000000000105D                 lea     rdi, main       ; main
.text:0000000000001064                 call    cs:__libc_start_main_ptr
.text:000000000000106A                 hlt
.text:000000000000106A ; } // starts at 1040
.text:000000000000106A start           endp
```

即装载器装载该文件进入内存之后,控制转移到进程映像相对映像基址的偏移量为0x1040的地方

该值可以在链接时修改,`gcc -e`指定入口函数

#### e_phoff

program headeer table offset

程序头部表在文件中的字节偏移量,如果没有程序头部表则该值为0

![image-20220805170202544](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220805170202544.png)

main中该值为64D=40H

![image-20220805170330203](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220805170330203.png)

而本文件的0x40位置确实是程序头部表的基地址

#### e_shoff

section header table offset

节头部表在文件中的字节偏移量,如果没有节头表则该值为0

![image-20220805170506360](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220805170506360.png)

main中该值为14090D=3700h

![image-20220805170723100](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220805170723100.png)

本文件的0x3700位置确实是节头表

#### e_flags

```
/* Values for Elf64_Ehdr.e_flags.  */

#define EF_SPARCV9_MM		3
#define EF_SPARCV9_TSO		0
#define EF_SPARCV9_PSO		1
#define EF_SPARCV9_RMO		2
#define EF_SPARC_LEDATA		0x800000 /* little endian data */
#define EF_SPARC_EXT_MASK	0xFFFF00
#define EF_SPARC_32PLUS		0x000100 /* generic V8+ features */
#define EF_SPARC_SUN_US1	0x000200 /* Sun UltraSPARC1 extensions */
#define EF_SPARC_HAL_R1		0x000400 /* HAL R1 extensions */
#define EF_SPARC_SUN_US3	0x000800 /* Sun UltraSPARCIII extensions */
```

处理器相关标志

#### e_ehsize

ELF文件头的大小

![image-20220805171525758](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220805171525758.png)

main中该值为64D=40H

即前64个字节是ELF header,后面紧接着是程序头表(如果存在的话)

#### e_phentsize

程序头表中表项的大小(每个表项一样大)

![image-20220805172137637](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220805172137637.png)

main中该值为56D

#### e_phnum

程序头项数

![image-20220805174430352](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220805174430352.png)

main中该值为23D

程序头项数乘以每项大小就可以计算得到程序头总大小56*23=1288字节

#### e_shentsize

section header entry size

节头表表项大小

![image-20220805174753025](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220805174753025.png)

main中该值为64D=40h

#### e_shnum

节头表项数

#### e_shstrndx

section header string table index,节名字符串表(.shstrtab)**的表头**在节头表中的下标

![image-20220806102105072](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220806102105072.png)

记录这么一个东西的目的是,方便获取各个节的名称,ELF头大小固定,节头表的基址在ELF头中已经给出,e_shoff,节头表表项大小业已给出e_shentsize,那么 `e_shoff+e_shentsize*e_shstrndx`就索引到了节名字符串表,方便获取节名

### 程序头表

Program Header Table ,是Elf64_Phdr结构体数组,描述**段信息**或者准备程序执行所需要的信息

> 一个段可能包含多个节.
>
> 程序运行时才会把多个性质相同的节合并成段,因此段表只对可执行目标文件有意义
>
> 可重定位目标文件中没有程序头表

![image-20220806081713545](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220806081713545.png)

main的程序头表中有13项,下标从0到12

程序头表项结构体 `struct Elf64_Phdr`(program header descriptor)

```c
typedef struct
{
  Elf64_Word	p_type;			/* Segment type */
  Elf64_Word	p_flags;		/* Segment flags */
  Elf64_Off	p_offset;		/* Segment file offset */
  Elf64_Addr	p_vaddr;		/* Segment virtual address */
  Elf64_Addr	p_paddr;		/* Segment physical address */
  Elf64_Xword	p_filesz;		/* Segment size in file */
  Elf64_Xword	p_memsz;		/* Segment size in memory */
  Elf64_Xword	p_align;		/* Segment alignment */
} Elf64_Phdr;
```

以栈段为例子,炎鸠一下段表项各成员的含义

![image-20220806082000923](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220806082000923.png)

#### p_type

段类型,枚举类型

```c
/* Legal values for p_type (segment type).  */

#define	PT_NULL		0		/* Program header table entry unused */
#define PT_LOAD		1		/* Loadable program segment */
#define PT_DYNAMIC	2		/* Dynamic linking information */
#define PT_INTERP	3		/* Program interpreter */
#define PT_NOTE		4		/* Auxiliary information */
#define PT_SHLIB	5		/* Reserved */
#define PT_PHDR		6		/* Entry for header table itself */
#define PT_TLS		7		/* Thread-local storage segment */
#define	PT_NUM		8		/* Number of defined types */
#define PT_LOOS		0x60000000	/* Start of OS-specific */
#define PT_GNU_EH_FRAME	0x6474e550	/* GCC .eh_frame_hdr segment */
#define PT_GNU_STACK	0x6474e551	/* Indicates stack executability */
#define PT_GNU_RELRO	0x6474e552	/* Read-only after relocation */
#define PT_GNU_PROPERTY	0x6474e553	/* GNU property */
#define PT_LOSUNW	0x6ffffffa
#define PT_SUNWBSS	0x6ffffffa	/* Sun Specific segment */
#define PT_SUNWSTACK	0x6ffffffb	/* Stack segment */
#define PT_HISUNW	0x6fffffff
#define PT_HIOS		0x6fffffff	/* End of OS-specific */
#define PT_LOPROC	0x70000000	/* Start of processor-specific */
#define PT_HIPROC	0x7fffffff	/* End of processor-specific */
```

> `PT_NULL(0)`表明该段未使用,对应程序头表项其他成员均没有定义

#### p_flags

```c
/* Legal values for p_flags (segment flags).  */

#define PF_X		(1 << 0)	/* Segment is executable */
#define PF_W		(1 << 1)	/* Segment is writable */
#define PF_R		(1 << 2)	/* Segment is readable */
#define PF_MASKOS	0x0ff00000	/* OS-specific */
#define PF_MASKPROC	0xf0000000	/* Processor-specific */
```

段权限,主要是RWX属性

比如使用最简单的gcc命令编译成的main栈段的权限:

![image-20220806083553366](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220806083553366.png)

此时栈是没有执行权限

如果编译时禁用NX保护 `gcc -z execstack main.c -o main`,此时栈就可以读写执行了

![image-20220806084047470](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220806084047470.png)

> 默认情况下是开启NX保护的
>
> `gcc -z execstack` 关闭NX保护
>
> `gcc -z noexecstack`开启NX保护

#### p_offset

文件偏移量,如果该段是程序运行时才会建立,比如堆栈,则该值为0

#### p_vaddr

相对虚拟地址

#### p_paddr

物理地址,该值只在直接使用物理内存的机器和系统上使用

#### p_filesz

文件中该段的大小

#### p_memsz

内存镜像中该段的大小

#### p_align

该段的对齐要求

该值为0或者1表示不用对齐,否则按照2的幂次对齐

要求 `p_vaddr`和 `p_offset`模 `p_align`要相等

### 节头表

main中节头表有30项

![](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220806084931736.png)

每一项都是 `Elf64_Shdr`结构体

```c
typedef struct
{
  Elf64_Word	sh_name;		/* Section name (string tbl index) */
  Elf64_Word	sh_type;		/* Section type */
  Elf64_Xword	sh_flags;		/* Section flags */
  Elf64_Addr	sh_addr;		/* Section virtual addr at execution */
  Elf64_Off	sh_offset;		/* Section file offset */
  Elf64_Xword	sh_size;		/* Section size in bytes */
  Elf64_Word	sh_link;		/* Link to another section */
  Elf64_Word	sh_info;		/* Additional section information */
  Elf64_Xword	sh_addralign;		/* Section alignment */
  Elf64_Xword	sh_entsize;		/* Entry size if section holds table */
} Elf64_Shdr;
```

#### sh_name

这里name不是直接的ASCII码表示的字符串,而是.shstrtab这个节中的偏移

> 一个 `Elf64_Word`即 `uint_32`,就四个字节,但是节名显然可以更长,比如 `.got.plt`

比如.data节节名的下标就是FCh

![image-20220806085921448](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220806085921448.png)

到shstrtab的节头看看

![image-20220806090138926](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220806090138926.png)

发现该节在文件中的偏移量为35ED,到该节中看看

![image-20220806090231225](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220806090231225.png)

该位置正是所有节名字符串的起点,所有的节名都是一块存放的,均以NULL结尾.那么划分节名的时候就是从本节区初,预见NULL则划分一个字符串作为一个节名

可以发现节区初 `0x35ED`就有一个NULL,这对应一个无名的节区(SHN_UNDEF)

![image-20220806090713731](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220806090713731.png)

35ED+FC=36E9

![image-20220806090419728](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220806090419728.png)

这个位置正是".data"字符串的起始位置

#### sh_type

节类型

```c
/* Legal values for sh_type (section type).  */

#define SHT_NULL	  0		/* Section header table entry unused */
#define SHT_PROGBITS	  1		/* Program data */
#define SHT_SYMTAB	  2		/* Symbol table */
#define SHT_STRTAB	  3		/* String table */
#define SHT_RELA	  4		/* Relocation entries with addends */
#define SHT_HASH	  5		/* Symbol hash table */
#define SHT_DYNAMIC	  6		/* Dynamic linking information */
#define SHT_NOTE	  7		/* Notes */
#define SHT_NOBITS	  8		/* Program space with no data (bss) */
#define SHT_REL		  9		/* Relocation entries, no addends */
#define SHT_SHLIB	  10		/* Reserved */
#define SHT_DYNSYM	  11		/* Dynamic linker symbol table */
#define SHT_INIT_ARRAY	  14		/* Array of constructors */
#define SHT_FINI_ARRAY	  15		/* Array of destructors */
#define SHT_PREINIT_ARRAY 16		/* Array of pre-constructors */
#define SHT_GROUP	  17		/* Section group */
#define SHT_SYMTAB_SHNDX  18		/* Extended section indices */
#define	SHT_NUM		  19		/* Number of defined types.  */
#define SHT_LOOS	  0x60000000	/* Start OS-specific.  */
#define SHT_GNU_ATTRIBUTES 0x6ffffff5	/* Object attributes.  */
#define SHT_GNU_HASH	  0x6ffffff6	/* GNU-style hash table.  */
#define SHT_GNU_LIBLIST	  0x6ffffff7	/* Prelink library list */
#define SHT_CHECKSUM	  0x6ffffff8	/* Checksum for DSO content.  */
#define SHT_LOSUNW	  0x6ffffffa	/* Sun-specific low bound.  */
#define SHT_SUNW_move	  0x6ffffffa
#define SHT_SUNW_COMDAT   0x6ffffffb
#define SHT_SUNW_syminfo  0x6ffffffc
#define SHT_GNU_verdef	  0x6ffffffd	/* Version definition section.  */
#define SHT_GNU_verneed	  0x6ffffffe	/* Version needs section.  */
#define SHT_GNU_versym	  0x6fffffff	/* Version symbol table.  */
#define SHT_HISUNW	  0x6fffffff	/* Sun-specific high bound.  */
#define SHT_HIOS	  0x6fffffff	/* End OS-specific type */
#define SHT_LOPROC	  0x70000000	/* Start of processor-specific */
#define SHT_HIPROC	  0x7fffffff	/* End of processor-specific */
#define SHT_LOUSER	  0x80000000	/* Start of application-specific */
#define SHT_HIUSER	  0x8fffffff	/* End of application-specific */
```

![image-20220806090940795](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220806090940795.png)

data节的类型为 `SHT_PROGBITS(1)`,意思是程序数据

bss节的类型是 `SHT_NOBITS(8)`,专门给bss节设置的节类型

#### sh_flags

节标志位

```c
/* Legal values for sh_flags (section flags).  */

#define SHF_WRITE	     (1 << 0)	/* Writable */
#define SHF_ALLOC	     (1 << 1)	/* Occupies memory during execution */
#define SHF_EXECINSTR	     (1 << 2)	/* Executable */
#define SHF_MERGE	     (1 << 4)	/* Might be merged */
#define SHF_STRINGS	     (1 << 5)	/* Contains nul-terminated strings */
#define SHF_INFO_LINK	     (1 << 6)	/* `sh_info' contains SHT index */
#define SHF_LINK_ORDER	     (1 << 7)	/* Preserve order after combining */
#define SHF_OS_NONCONFORMING (1 << 8)	/* Non-standard OS specific handling
					   required */
#define SHF_GROUP	     (1 << 9)	/* Section is member of a group.  */
#define SHF_TLS		     (1 << 10)	/* Section hold thread-local data.  */
#define SHF_COMPRESSED	     (1 << 11)	/* Section with compressed data. */
#define SHF_MASKOS	     0x0ff00000	/* OS-specific.  */
#define SHF_MASKPROC	     0xf0000000	/* Processor-specific */
#define SHF_GNU_RETAIN	     (1 << 21)  /* Not to be GCed by linker.  */
#define SHF_ORDERED	     (1 << 30)	/* Special ordering requirement
					   (Solaris).  */
#define SHF_EXCLUDE	     (1U << 31)	/* Section is excluded unless
					   referenced or allocated (Solaris).*/

```

> SHF_WRITE:该节在进程虚拟空间中可写
>
> SHF_ALLOC:该节在进程虚拟内存中需要分配空间,比如text,data,bss节
>
> SHF_EXECINSTR:该节在进程虚拟空间中可执行,比如text

都是2的幂次,多个属性按位或

.data节的标志是3,意味着可以分配,可以执行

#### sh_addr

节虚拟地址,如果该节会被加载,则该值为节在虚拟内存中的地址

#### sh_offset

节文件偏移,不是本节头的文件偏移,而是本节头指向对应的节的偏移量

为啥要节和节头分家?

每个节的大小固定,如果有额外信息,比如shrstrtab需要额外保存字符数组,则用该成员作为指针另外指向一片区域

这样加载时读取节头不用担心有大有小,直接读取整个节头表即可

#### sh_size

节区大小,不是节头大小,而是节头指向的对应节区的大小

#### sh_link&sh_info

节链接信息,这两个成员的意义视sh_type而定

> 来自CTF wiki:
>
> | sh_type               | sh_link                                                                                                         | sh_info                    |
> | :-------------------- | :-------------------------------------------------------------------------------------------------------------- | :------------------------- |
> | SHT_DYNAMIC           | 节区中使用的字符串表的节头索引                                                                                  | 0                          |
> | SHT_HASH              | 此哈希表所使用的符号表的节头索引                                                                                | 0                          |
> | SHT_REL/SHT_RELA      | 与符号表相关的节头索引                                                                                          | 重定位应用到的节的节头索引 |
> | SHT_SYMTAB/SHT_DYNSYM | 操作系统特定信息，Linux 中的 ELF 文件中该项指向符号表中符号所对应的字符串节区在 Section Header Table 中的偏移。 | 操作系统特定信息           |
> | other                 | `SHN_UNDEF`                                                                                                   | 0                          |

#### sh_addralign

节虚拟地址对齐要求

#### sh_entsize

如果本节也是一个数组,则本项目表征的是数组元素大小

比如got表

![image-20220806092014449](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220806092014449.png)

其表项就是一个动态库中的实际虚拟地址,在64位系统上,8字节即可寻址整个虚拟地址空间,因此got节头中该值为8

### 节区

程序员的自我修养P77给了一张SimpleSection.o的文件视图

![image-20220806094931783](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220806094931783.png)

越看越不对劲,最后发现不对劲是因为,.o文件不需要程序头表也就罢了,节头表section Table为啥没有紧挨着ELF头?而是夹在一些节区中间?

ELF头后面紧跟着的是text节

推测,Section Table后面的是链接需要用到的节,前面链接用不到

![image-20220806095428497](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220806095428497.png)

010editor将符号表和动态符号表与节区头表,程序头表,elf头并列分析了

而实际上symbol_table和dynamic_symbol_table都是节区,只不过这两个节区都是表

#### 字符串表

对应节头是这样的:

![image-20220806100917610](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220806100917610.png)

s_offset表明字符串表的文件偏移为0x33F0

s_size表明字符串表的大小是509字节

那么字符串表在文件中的位置就是 `[33F0h,35F9h]`

![image-20220806101143997](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220806101143997.png)

其中的字符串均以NULL结尾,那么需要引用其中的字符串时,只需要给出相应字符串在字符串表中的下标或者偏移量,不需要再给出长度或者结尾的偏移

找到NULL就意味着字符串结束

#### 节名字符串表

作用类似于字符串表,都是字符数组,只不过节名字符串表专门存放节名字符串

本节对应节头是这样写的:

![image-20220806101528306](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220806101528306.png)

最下面这个 `char data[272]`是010editor故意把节直接放到这里观察了,就是节名字符串表

![image-20220806101712880](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220806101712880.png)

各个节头中的 `Elf32_Shdr.sh_name`成员,就是本表中的字符串偏移量

#### 符号表

符号:函数和变量统称符号

为了更清晰地观察符号表写一个 `test.c`并编译成可重定位目标模块

`test.c`

```c
#include <stdio.h>
int global_initialized=10;
int global_uninitialized;
static int static_initialized=20;
static int static_uninitialized;
int main(){
    int local;
    printf("%d,%d,%d,%d,%d",global_initialized,global_uninitialized,static_initialized,static_uninitialized,local);
    return 0;
}
```

```c
gcc test.c -O0 -c -o test.o
```

符号表对应的节头是这样写的:

![image-20220806103614207](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220806103614207.png)

s_offset表明符号表的基地址在文件中的F8h

![image-20220806103655607](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220806103655607.png)

确实是一个表,有12项,其中就包括 `static_initialized`等全局或者静态变量,`main`,`printf`等函数名

每个表项的结构相同

```c
typedef struct
{
  Elf32_Word	st_name;		/* Symbol name (string tbl index) */
  Elf32_Addr	st_value;		/* Symbol value */
  Elf32_Word	st_size;		/* Symbol size */
  unsigned char	st_info;		/* Symbol type and binding */
  unsigned char	st_other;		/* Symbol visibility */
  Elf32_Section	st_shndx;		/* Section index */
} Elf32_Sym;

typedef struct
{
  Elf64_Word	st_name;		/* Symbol name (string tbl index) */
  unsigned char	st_info;		/* Symbol type and binding */
  unsigned char st_other;		/* Symbol visibility */
  Elf64_Section	st_shndx;		/* Section index */
  Elf64_Addr	st_value;		/* Symbol value */
  Elf64_Xword	st_size;		/* Symbol size */
} Elf64_Sym;
```

> 注意64位和32位的结构体成员顺序不一样

##### st_name

本符号名字符串在strtab字符串表中的偏移量

比如 `static_initialized`这一项中,该值为8h

![image-20220806103940309](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220806103940309.png)

去查strtab表,对应strtab表头的sh_offset表明strtab表在0x218,那么 `static_initialized`字符串就应该是从0x220开始一直到NULL结尾

![image-20220806104112403](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220806104112403.png)

确实如此

##### st_info

符号类型和绑定信息

st_info为unsigned char类型,8位,高四位和低四位分别表示符号绑定信息和符号类型

```c
//低四位表示符号类型
/* Legal values for ST_BIND subfield of st_info (symbol binding).  */

#define STB_LOCAL	0		/* Local symbol,局部符号 */
#define STB_GLOBAL	1		/* Global symbol,全局符号 */
#define STB_WEAK	2		/* Weak symbol,弱引用 */
#define	STB_NUM		3		/* Number of defined types.  一共就三种符号,0,1,2*/
//STB_NUM表明一共就三种符号

//高四位表示符号绑定信息
/* Legal values for ST_TYPE subfield of st_info (symbol type).  */

#define STT_NOTYPE	0		/* Symbol type is unspecified ,未知类型符号*/
#define STT_OBJECT	1		/* Symbol is a data object ,数据对象,数组,变量,对象*/
#define STT_FUNC	2		/* Symbol is a code object ,函数*/
#define STT_SECTION	3		/* Symbol associated with a section ,节*/
#define STT_FILE	4		/* Symbol's name is file name ,文件名*/
#define STT_COMMON	5		/* Symbol is a common data object */
#define STT_TLS		6		/* Symbol is thread-local data object*/
#define	STT_NUM		7		/* Number of defined types.  */
//STT_NUM表明一共就7种符号绑定信息
```

比如 `global_initialized`这个符号,是一个全局的数据对象

![image-20220806105817155](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220806105817155.png)

又比如 `test.c`这个符号

![image-20220806105930937](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220806105930937.png)

是一个局部文件名符号

##### st_other

预留的成员,目前没用

##### st_shndx

符号所在节的下标

比如 `main`这个符号,不用想啃腚是在text节

![image-20220806104544566](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220806104544566.png)

该值为1,去查节头表

![image-20220806104627621](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220806104627621.png)

下标为1的节就是.text

对于不在本文件中定义的符号或者一些特殊符号,该值有特殊意义

```c
/* Special section indices.  */

#define SHN_UNDEF	0		/* Undefined section ,本符号未在本文件定义,只在本文件中被引用,可能定义在其他文件中*/
#define SHN_LORESERVE	0xff00		/* Start of reserved indices */
#define SHN_LOPROC	0xff00		/* Start of processor-specific */
#define SHN_BEFORE	0xff00		/* Order section before all others
					   (Solaris).  */
#define SHN_AFTER	0xff01		/* Order section after all others
					   (Solaris).  */
#define SHN_HIPROC	0xff1f		/* End of processor-specific */
#define SHN_LOOS	0xff20		/* Start of OS-specific */
#define SHN_HIOS	0xff3f		/* End of OS-specific */
#define SHN_ABS		0xfff1		/* Associated symbol is absolute ,一个绝对的值*/
#define SHN_COMMON	0xfff2		/* Associated symbol is common ,该符号是一个COMMON伪节中的符号,未初始化的全局符号*/
#define SHN_XINDEX	0xffff		/* Index is in extra table.  */
#define SHN_HIRESERVE	0xffff		/* End of reserved indices */
```

比如 `test.c`这个符号

![image-20220806110254225](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220806110254225.png)

该值为65521D=FFF1H,表示该符号包含了一个绝对的值

##### st_value

符号对应值,不同类型的文件中该值意义不同

**在可执行目标文件中**

该值表示符号的虚拟地址

> 比如main这个符号,其st_value值为0x1129
>
> ![image-20220806110947749](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220806110947749.png)
>
> 用ida64加载观察之
>
> ![image-20220806111114579](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220806111114579.png)
>
> main确实在1129位置

**在可重定位目标模块中**

**如果该符号是一个定义**(不是引用,即 `st_shndx`的值不是 `SHN_UNDEF`),并且不是未初始化的全局变量(即不在 `COMMON`伪节,即 `st_shndx`不为 `SHN_COMMON`),则该值表示的是该符号在对应节中的偏移量,这个节就是 `st_shndx`指定的节

比如静态未初始化变量,

![image-20220806111635430](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220806111635430.png)

`st_shndx=4`表明他在bss段

`st_value=0x4`表明它的偏移量为4,即bss段的第五个字节,那么前四个字节是谁?global_uninitialized

![image-20220806111854194](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220806111854194.png)

如果该符号在COMMON块,则st_value表示的是该符号的对齐要求

##### st_size

该符号表的大小

#### 重定位表

重定位表可以有多个,如果text节需要重定位,则会有一个.rel.text,如果data节需要重定位,则会有一个.rel.data

`test.c`

```c
#include <stdio.h>
#include <stdlib.h>
extern int value;//外部变量
int add(int,int);//外部函数

int main(){
        printf("test Link\n");
        printf("sum=%d\n",add(5,6));
        printf("value=%d",value);
        return 0;
}
```

```
gcc test.c -c
```

对于只编译不链接得到的test.o,使用objdump反汇编观察其main函数

```c
┌──(root㉿Executor)-[/mnt/c/Users/86135/desktop/COFF]
└─# objdump -d test.o

test.o:     file format elf64-x86-64


Disassembly of section .text:

0000000000000000 <main>:
   0:   55                      push   %rbp
   1:   48 89 e5                mov    %rsp,%rbp
   4:   48 8d 05 00 00 00 00    lea    0x0(%rip),%rax        # b <main+0xb>
   b:   48 89 c7                mov    %rax,%rdi
   e:   e8 00 00 00 00          call   13 <main+0x13>
  13:   be 06 00 00 00          mov    $0x6,%esi
  18:   bf 05 00 00 00          mov    $0x5,%edi
  1d:   e8 00 00 00 00          call   22 <main+0x22>
  22:   89 c6                   mov    %eax,%esi
  24:   48 8d 05 00 00 00 00    lea    0x0(%rip),%rax        # 2b <main+0x2b>
  2b:   48 89 c7                mov    %rax,%rdi
  2e:   b8 00 00 00 00          mov    $0x0,%eax
  33:   e8 00 00 00 00          call   38 <main+0x38>
  38:   8b 05 00 00 00 00       mov    0x0(%rip),%eax        # 3e <main+0x3e>
  3e:   89 c6                   mov    %eax,%esi
  40:   48 8d 05 00 00 00 00    lea    0x0(%rip),%rax        # 47 <main+0x47>
  47:   48 89 c7                mov    %rax,%rdi
  4a:   b8 00 00 00 00          mov    $0x0,%eax
  4f:   e8 00 00 00 00          call   54 <main+0x54>
  54:   b8 00 00 00 00          mov    $0x0,%eax
  59:   5d                      pop    %rbp
  5a:   c3                      ret
```

可以发现其中main+4,main+e,main+1d等等处的指令中有四个字节的0

实际上是由于,编译器对于 `__main`函数,`add`函数,`value`外部变量无法解析其位置,于是全都置零等待链接器填坑

观察其重定位表

```c
┌──(root㉿Executor)-[/mnt/c/Users/86135/desktop/COFF]
└─# objdump -r test.o

test.o:     file format elf64-x86-64

RELOCATION RECORDS FOR [.text]:
OFFSET           TYPE              VALUE
0000000000000007 R_X86_64_PC32     .rodata-0x0000000000000004
000000000000000f R_X86_64_PLT32    puts-0x0000000000000004		;此处的puts是编译器将printf优化成了puts
000000000000001e R_X86_64_PLT32    add-0x0000000000000004
0000000000000027 R_X86_64_PC32     .rodata+0x0000000000000006
0000000000000034 R_X86_64_PLT32    printf-0x0000000000000004
000000000000003a R_X86_64_PC32     value-0x0000000000000004
0000000000000043 R_X86_64_PC32     .rodata+0x000000000000000e
0000000000000050 R_X86_64_PLT32    printf-0x0000000000000004


RELOCATION RECORDS FOR [.eh_frame]:
OFFSET           TYPE              VALUE
0000000000000020 R_X86_64_PC32     .text
```

`RELOCATION RECORDS FOR [.text]:`这表示紧跟在后面是text节的符号的重定位条目

| 栏目   | 意义                                                                                                |
| ------ | --------------------------------------------------------------------------------------------------- |
| OFFSET | 该符号在其对应段中的偏移量                                                                          |
| TYPE   | 重定位方式,这里有两种,PLT或者PC,是最常见的两种,PC重定位适用于变量的引用,PLT重定位适用于函数的重定位 |
| VALUE  | 需要重定位的符号                                                                                    |

比如 `0000000000000034 R_X86_64_PLT32    printf-0x0000000000000004`这一条,

```c
  33:   e8 00 00 00 00          call   38 <main+0x38>
  38:   8b 05 00 00 00 00       mov    0x0(%rip),%eax        # 3e <main+0x3e>
```

它恰好是main+33处的call的操作数(0xe8为call指令的操作码,后面的00就是main+34)

编译器会给每个需要重定位的符号建立一个**重定位条目**(然而自我修养上作者将Relocation Entry翻译成了重定位入口,感觉此处的Entry不如翻译成条目)

重定位条目是一个结构体:

```c
/* The following, at least, is used on Sparc v9, MIPS, and Alpha.  */

typedef struct
{
  Elf64_Addr	r_offset;		/* Address */
  Elf64_Xword	r_info;			/* Relocation type and symbol index */
} Elf64_Rel;
```

##### r_offset

需要修正的位置,相对于该符号所在节的偏移量

就是objdump -r之后的OFFSET栏目

##### r_info

重定位条目的类型和符号

## 工具

### Linux ELF

#### gcc编译链接

##### 只编译不链接

```
gcc -c main.c -o main.o
```

##### 编译链接

```
gcc main.c -o main
```

#### file查看文件格式

lilnux上 `file`的参数可以为任何文件,其作用是报告该文件的基本信息

```shell
┌──(root㉿Executor)-[/mnt/c/Users/86135/desktop/COFF]
└─# file main.c
main.c: C source, ASCII text, with CRLF line terminators

┌──(root㉿Executor)-[/mnt/c/Users/86135/desktop/COFF]
└─# file main.exe
main.exe: PE32+ executable (console) x86-64, for MS Windows

┌──(root㉿Executor)-[/mnt/c/Users/86135/desktop/COFF]
└─# file main
main: ELF 64-bit LSB pie executable, x86-64, version 1 (SYSV), dynamically linked, interpreter /lib64/ld-linux-x86-64.so.2, BuildID[sha1]=45f82af9109c5336fc17e25b88c4ce4def86b6e2, for GNU/Linux 3.2.0, not stripped
```

#### objdump 观察结构

##### objdump -h观察节区基本信息

| 栏目     | 意义                                                                         |
| :------- | ---------------------------------------------------------------------------- |
| Idx      | 节区在节区表中的顺序编号                                                     |
| Name     | 节区名                                                                       |
| Size     | 本节区大小                                                                   |
| VMA      |                                                                              |
| LMA      |                                                                              |
| File off | 本节区在文件中的偏移量                                                       |
| Align    | 本节区的对齐要求,`2**n`意思是$2^n$字节对齐,节区首地址必须是$2^n$的倍数 |
| 节区属性 | CONTENTS                                                                     |
|          |                                                                              |

```shell
┌──(root㉿Executor)-[/mnt/c/Users/86135/desktop/COFF]
└─# objdump -h main

main:     file format elf64-x86-64

Sections:
Idx Name          Size      VMA               LMA               File off  Algn
  0 .interp       0000001c  0000000000000318  0000000000000318  00000318  2**0
                  CONTENTS, ALLOC, LOAD, READONLY, DATA
  1 .note.gnu.property 00000020  0000000000000338  0000000000000338  00000338  2**3
                  CONTENTS, ALLOC, LOAD, READONLY, DATA
  2 .note.gnu.build-id 00000024  0000000000000358  0000000000000358  00000358  2**2
                  CONTENTS, ALLOC, LOAD, READONLY, DATA
  3 .note.ABI-tag 00000020  000000000000037c  000000000000037c  0000037c  2**2
                  CONTENTS, ALLOC, LOAD, READONLY, DATA
  4 .gnu.hash     00000024  00000000000003a0  00000000000003a0  000003a0  2**3
                  CONTENTS, ALLOC, LOAD, READONLY, DATA
  5 .dynsym       00000090  00000000000003c8  00000000000003c8  000003c8  2**3
                  CONTENTS, ALLOC, LOAD, READONLY, DATA
  6 .dynstr       0000007d  0000000000000458  0000000000000458  00000458  2**0
                  CONTENTS, ALLOC, LOAD, READONLY, DATA
  7 .gnu.version  0000000c  00000000000004d6  00000000000004d6  000004d6  2**1
                  CONTENTS, ALLOC, LOAD, READONLY, DATA
  8 .gnu.version_r 00000020  00000000000004e8  00000000000004e8  000004e8  2**3
                  CONTENTS, ALLOC, LOAD, READONLY, DATA
  9 .rela.dyn     000000c0  0000000000000508  0000000000000508  00000508  2**3
                  CONTENTS, ALLOC, LOAD, READONLY, DATA
 10 .init         00000017  0000000000001000  0000000000001000  00001000  2**2
                  CONTENTS, ALLOC, LOAD, READONLY, CODE
 11 .plt          00000010  0000000000001020  0000000000001020  00001020  2**4
                  CONTENTS, ALLOC, LOAD, READONLY, CODE
 12 .plt.got      00000008  0000000000001030  0000000000001030  00001030  2**3
                  CONTENTS, ALLOC, LOAD, READONLY, CODE
 13 .text         00000161  0000000000001040  0000000000001040  00001040  2**4
                  CONTENTS, ALLOC, LOAD, READONLY, CODE
 14 .fini         00000009  00000000000011a4  00000000000011a4  000011a4  2**2
                  CONTENTS, ALLOC, LOAD, READONLY, CODE
 15 .rodata       00000004  0000000000002000  0000000000002000  00002000  2**2
                  CONTENTS, ALLOC, LOAD, READONLY, DATA
 16 .eh_frame_hdr 0000003c  0000000000002004  0000000000002004  00002004  2**2
                  CONTENTS, ALLOC, LOAD, READONLY, DATA
 17 .eh_frame     00000108  0000000000002040  0000000000002040  00002040  2**3
                  CONTENTS, ALLOC, LOAD, READONLY, DATA
 18 .init_array   00000008  0000000000003e18  0000000000003e18  00002e18  2**3
                  CONTENTS, ALLOC, LOAD, DATA
 19 .fini_array   00000008  0000000000003e20  0000000000003e20  00002e20  2**3
                  CONTENTS, ALLOC, LOAD, DATA
 20 .dynamic      000001b0  0000000000003e28  0000000000003e28  00002e28  2**3
                  CONTENTS, ALLOC, LOAD, DATA
 21 .got          00000028  0000000000003fd8  0000000000003fd8  00002fd8  2**3
                  CONTENTS, ALLOC, LOAD, DATA
 22 .got.plt      00000018  0000000000004000  0000000000004000  00003000  2**3
                  CONTENTS, ALLOC, LOAD, DATA
 23 .data         00000010  0000000000004018  0000000000004018  00003018  2**3
                  CONTENTS, ALLOC, LOAD, DATA
 24 .bss          00000008  0000000000004028  0000000000004028  00003028  2**0
                  ALLOC
 25 .comment      0000001e  0000000000000000  0000000000000000  00003028  2**0
                  CONTENTS, READONLY
```

> 各段作用
>
> ![image-20220805152931491](https://raw.githubusercontent.com/DeutschBall/test/master/image-20220805152931491.png)

##### objdump -s 以16进制打印各节内容

```shell
┌──(root㉿Executor)-[/mnt/c/Users/86135/desktop/COFF]
└─# objdump -s main

main:     file format elf64-x86-64

...
Contents of section .init:
 1000 4883ec08 488b05dd 2f000048 85c07402  H...H.../..H..t.
 1010 ffd04883 c408c3                      ..H....
Contents of section .plt:
 1020 ff35e22f 0000ff25 e42f0000 0f1f4000  .5./...%./....@.
Contents of section .plt.got:
 1030 ff25c22f 00006690                    .%./..f.
Contents of section .text:
 1040 31ed4989 d15e4889 e24883e4 f050544c  1.I..^H..H...PTL
 1050 8d054a01 0000488d 0de30000 00488d3d  ..J...H......H.=
 1060 c5000000 ff15762f 0000f40f 1f440000  ......v/.....D..
 1070 488d3db1 2f000048 8d05aa2f 00004839  H.=./..H.../..H9
 1080 f8741548 8b054e2f 00004885 c07409ff  .t.H..N/..H..t..
 1090 e00f1f80 00000000 c30f1f80 00000000  ................
 10a0 488d3d81 2f000048 8d357a2f 00004829  H.=./..H.5z/..H)
 10b0 fe4889f0 48c1ee3f 48c1f803 4801c648  .H..H..?H...H..H
 10c0 d1fe7414 488b0525 2f000048 85c07408  ..t.H..%/..H..t.
 10d0 ffe0660f 1f440000 c30f1f80 00000000  ..f..D..........
 10e0 f30f1efa 803d3d2f 00000075 2b554883  .....==/...u+UH.
 10f0 3d022f00 00004889 e5740c48 8b3d1e2f  =./...H..t.H.=./
 1100 0000e829 ffffffe8 64ffffff c605152f  ...)....d....../
 1110 0000015d c30f1f00 c30f1f80 00000000  ...]............
 1120 f30f1efa e977ffff ff554889 e5b80000  .....w...UH.....
 1130 00005dc3 662e0f1f 84000000 00006690  ..].f.........f.
 1140 41574c8d 3dcf2c00 00415649 89d64155  AWL.=.,..AVI..AU
 1150 4989f541 544189fc 55488d2d c02c0000  I..ATA..UH.-.,..
 1160 534c29fd 4883ec08 e893feff ff48c1fd  SL).H........H..
 1170 03741b31 db0f1f00 4c89f24c 89ee4489  .t.1....L..L..D.
 1180 e741ff14 df4883c3 014839dd 75ea4883  .A...H...H9.u.H.
 1190 c4085b5d 415c415d 415e415f c30f1f00  ..[]A\A]A^A_....
 11a0 c3                                   .
Contents of section .fini:
...
```

##### objdump -d	反汇编包含指令的段

```shell
┌──(root㉿Executor)-[/mnt/c/Users/86135/desktop/COFF]
└─# objdump -d main

main:     file format elf64-x86-64


Disassembly of section .init:

0000000000001000 <_init>:
    1000:       48 83 ec 08             sub    $0x8,%rsp
    1004:       48 8b 05 dd 2f 00 00    mov    0x2fdd(%rip),%rax        # 3fe8 <__gmon_start__@Base>
    100b:       48 85 c0                test   %rax,%rax
    100e:       74 02                   je     1012 <_init+0x12>
    1010:       ff d0                   call   *%rax
    1012:       48 83 c4 08             add    $0x8,%rsp
    1016:       c3                      ret
....
0000000000001129 <main>:
    1129:       55                      push   %rbp
    112a:       48 89 e5                mov    %rsp,%rbp
    112d:       b8 00 00 00 00          mov    $0x0,%eax
    1132:       5d                      pop    %rbp
    1133:       c3                      ret
    1134:       66 2e 0f 1f 84 00 00    cs nopw 0x0(%rax,%rax,1)
    113b:       00 00 00
    113e:       66 90                   xchg   %ax,%ax

...
```

##### objdump -r 观察重定位表

```shell
┌──(root㉿Executor)-[/mnt/c/Users/86135/desktop/COFF]
└─# objdump -r test.o

test.o:     file format elf64-x86-64

RELOCATION RECORDS FOR [.text]:
OFFSET           TYPE              VALUE
0000000000000007 R_X86_64_PC32     .rodata-0x0000000000000004
000000000000000f R_X86_64_PLT32    puts-0x0000000000000004
000000000000001e R_X86_64_PLT32    add-0x0000000000000004
0000000000000027 R_X86_64_PC32     .rodata+0x0000000000000006
0000000000000034 R_X86_64_PLT32    printf-0x0000000000000004
000000000000003a R_X86_64_PC32     value-0x0000000000000004
0000000000000043 R_X86_64_PC32     .rodata+0x000000000000000e
0000000000000050 R_X86_64_PLT32    printf-0x0000000000000004


RELOCATION RECORDS FOR [.eh_frame]:
OFFSET           TYPE              VALUE
0000000000000020 R_X86_64_PC32     .text
```

#### size观察代码数据段的长度

```c
┌──(root㉿Executor)-[/mnt/c/Users/86135/desktop/COFF]
└─# size main
   text    data     bss     dec     hex filename
   1406     528       8    1942     796 main
   ;text代码段长度(10进制)	data数据段长度(10进制)	bss未初始化数据段(10进制) dec这三个段长度和(10进制) hex这三个段的长度和(16进制)
```

#### readelf观察ELF格式

##### readelf -h观察ELF头

```shell
┌──(root㉿Executor)-[/mnt/c/Users/86135/desktop/COFF]
└─# readelf -h main
ELF Header:
  Magic:   7f 45 4c 46 02 01 01 00 00 00 00 00 00 00 00 00
  Class:                             ELF64
  Data:                              2's complement, little endian
  Version:                           1 (current)
  OS/ABI:                            UNIX - System V
  ABI Version:                       0
  Type:                              DYN (Position-Independent Executable file)
  Machine:                           Advanced Micro Devices X86-64
  Version:                           0x1
  Entry point address:               0x1040
  Start of program headers:          64 (bytes into file)
  Start of section headers:          14080 (bytes into file)
  Flags:                             0x0
  Size of this header:               64 (bytes)
  Size of program headers:           56 (bytes)
  Number of program headers:         13
  Size of section headers:           64 (bytes)
  Number of section headers:         30
  Section header string table index: 29
```

##### readelf -S观察各节区

```shell
┌──(root㉿Executor)-[/mnt/c/Users/86135/desktop/COFF]
└─# readelf -S main
There are 30 section headers, starting at offset 0x3700:

Section Headers:
  [Nr] Name              Type             Address           Offset
       Size              EntSize          Flags  Link  Info  Align
  [ 0]                   NULL             0000000000000000  00000000
       0000000000000000  0000000000000000           0     0     0
  [ 1] .interp           PROGBITS         0000000000000318  00000318
       000000000000001c  0000000000000000   A       0     0     1
  [ 2] .note.gnu.pr[...] NOTE             0000000000000338  00000338
       0000000000000020  0000000000000000   A       0     0     8
  [ 3] .note.gnu.bu[...] NOTE             0000000000000358  00000358
       0000000000000024  0000000000000000   A       0     0     4
  [ 4] .note.ABI-tag     NOTE             000000000000037c  0000037c
       0000000000000020  0000000000000000   A       0     0     4
  [ 5] .gnu.hash         GNU_HASH         00000000000003a0  000003a0
       0000000000000024  0000000000000000   A       6     0     8
  [ 6] .dynsym           DYNSYM           00000000000003c8  000003c8
       0000000000000090  0000000000000018   A       7     1     8
  [ 7] .dynstr           STRTAB           0000000000000458  00000458
       000000000000007d  0000000000000000   A       0     0     1
  [ 8] .gnu.version      VERSYM           00000000000004d6  000004d6
       000000000000000c  0000000000000002   A       6     0     2
  [ 9] .gnu.version_r    VERNEED          00000000000004e8  000004e8
       0000000000000020  0000000000000000   A       7     1     8
  [10] .rela.dyn         RELA             0000000000000508  00000508
       00000000000000c0  0000000000000018   A       6     0     8
  [11] .init             PROGBITS         0000000000001000  00001000
       0000000000000017  0000000000000000  AX       0     0     4
  [12] .plt              PROGBITS         0000000000001020  00001020
       0000000000000010  0000000000000010  AX       0     0     16
  [13] .plt.got          PROGBITS         0000000000001030  00001030
       0000000000000008  0000000000000008  AX       0     0     8
  [14] .text             PROGBITS         0000000000001040  00001040
       0000000000000161  0000000000000000  AX       0     0     16
  [15] .fini             PROGBITS         00000000000011a4  000011a4
       0000000000000009  0000000000000000  AX       0     0     4
  [16] .rodata           PROGBITS         0000000000002000  00002000
       0000000000000004  0000000000000004  AM       0     0     4
  [17] .eh_frame_hdr     PROGBITS         0000000000002004  00002004
       000000000000003c  0000000000000000   A       0     0     4
  [18] .eh_frame         PROGBITS         0000000000002040  00002040
       0000000000000108  0000000000000000   A       0     0     8
  [19] .init_array       INIT_ARRAY       0000000000003e18  00002e18
       0000000000000008  0000000000000008  WA       0     0     8
  [20] .fini_array       FINI_ARRAY       0000000000003e20  00002e20
       0000000000000008  0000000000000008  WA       0     0     8
  [21] .dynamic          DYNAMIC          0000000000003e28  00002e28
       00000000000001b0  0000000000000010  WA       7     0     8
  [22] .got              PROGBITS         0000000000003fd8  00002fd8
       0000000000000028  0000000000000008  WA       0     0     8
  [23] .got.plt          PROGBITS         0000000000004000  00003000
       0000000000000018  0000000000000008  WA       0     0     8
  [24] .data             PROGBITS         0000000000004018  00003018
       0000000000000010  0000000000000000  WA       0     0     8
  [25] .bss              NOBITS           0000000000004028  00003028
       0000000000000008  0000000000000000  WA       0     0     1
  [26] .comment          PROGBITS         0000000000000000  00003028
       000000000000001e  0000000000000001  MS       0     0     1
  [27] .symtab           SYMTAB           0000000000000000  00003048
       00000000000003a8  0000000000000018          28    21     8
  [28] .strtab           STRTAB           0000000000000000  000033f0
       00000000000001fd  0000000000000000           0     0     1
  [29] .shstrtab         STRTAB           0000000000000000  000035ed
       0000000000000110  0000000000000000           0     0     1
Key to Flags:
  W (write), A (alloc), X (execute), M (merge), S (strings), I (info),
  L (link order), O (extra OS processing required), G (group), T (TLS),
  C (compressed), x (unknown), o (OS specific), E (exclude),
  D (mbind), l (large), p (processor specific)
```

Nr:下标

Name:节名字符串在 `.shstrtab`字符串表中的偏移量

Type:节类型

Address:节虚拟地址

Offset:节文件偏移

Size:节大小

EntSize:节项目(如果节是一个表的话)大小

Flags:节属性

Link&Info:节链接信息

Align:节对齐要求

##### readelf -s观察符号

```shell
┌──(root㉿Executor)-[/mnt/c/Users/86135/desktop/COFF]
└─# readelf -s test.o

Symbol table '.symtab' contains 12 entries:
   Num:    Value          Size Type    Bind   Vis      Ndx Name
     0: 0000000000000000     0 NOTYPE  LOCAL  DEFAULT  UND
     1: 0000000000000000     0 FILE    LOCAL  DEFAULT  ABS test.c
     2: 0000000000000000     0 SECTION LOCAL  DEFAULT    1 .text
     3: 0000000000000000     0 SECTION LOCAL  DEFAULT    3 .data
     4: 0000000000000000     0 SECTION LOCAL  DEFAULT    4 .bss
     5: 0000000000000004     4 OBJECT  LOCAL  DEFAULT    3 static_initialized
     6: 0000000000000004     4 OBJECT  LOCAL  DEFAULT    4 static_uninitialized
     7: 0000000000000000     0 SECTION LOCAL  DEFAULT    5 .rodata
     8: 0000000000000000     4 OBJECT  GLOBAL DEFAULT    3 global_initialized
     9: 0000000000000000     4 OBJECT  GLOBAL DEFAULT    4 global_uninitialized
    10: 0000000000000000    70 FUNC    GLOBAL DEFAULT    1 main
    11: 0000000000000000     0 NOTYPE  GLOBAL DEFAULT  UND printf
```

| 栏目  | 意义                         |
| ----- | ---------------------------- |
| Num   | 符号表数组中的下标           |
| Value | st_value符号值               |
| Size  | st_size符号大小              |
| Type  | st_info低四位符号类型        |
| Bind  | st_info高四位符号绑定信息    |
| Vis   | st_other尚未使用,都是DEFAULT |
| Ndx   | st_shndx                     |
| Name  | 符号名称                     |

#### nm观察符号表

```shell
┌──(root㉿Executor)-[/mnt/c/Users/86135/desktop/COFF]
└─# nm -a test.o
0000000000000000 b .bss
0000000000000000 d .data
0000000000000000 D global_initialized
0000000000000000 B global_uninitialized
0000000000000000 T main
                 U printf
0000000000000000 r .rodata
0000000000000004 d static_initialized
0000000000000004 b static_uninitialized
0000000000000000 a test.c
0000000000000000 t .text
```

#### ar处理静态库

##### ar -t查看归档文件包括的目标模块

```shell
┌──(root㉿Executor)-[/mnt/c/Users/86135/desktop/COFF]
└─# ar -t /usr/lib32/libc.a
init-first.o
libc-start.o
sysdep.o
version.o
check_fds.o
libc-tls.o
elf-init.o
...
```

##### ar -x将归档文件解包,释放所有.o目标模块
