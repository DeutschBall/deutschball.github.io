---
title: AFL III - AFL-tmin
date: 2025-4-22 13:11:01
# tags:
#   - 模糊测试
mathjax: true







---





# [AFL III]AFL-tmin

## dry_run

在正式开始最小化输入时, afl-tmin会先尝试执行一下目标程序

如果能够造成崩溃, 并且命令行参数上有-x 崩溃指导模式, 则设定工作在崩溃指导模式

否则设定为执行路径指导模式

## minimize

最小化过程中有四个操作

BLOCK NORMALIZATION

BLOCK DELETION

ALPHABET MINIMIZATION

CHARACTER MINIMIZATION

### NORMALIZATION

“块标准化”,尝试将输入以块为单位置‘0’,此举意在排除输入中的非‘0’字符对执行路径造成影响

> 注意不是置NULL,是字符‘0’,ascii值为0x30
>
> 因为 字符串处理函数 在面对NULL时的行为 和面对其他字符时的行为 不太一样

以输入4000个字节为例, 此时有: 

```
in_data = char[4000];
in_len = 4000;
set_len = next_p2(4000/128) = 32
set_pos = 0
```

![image-20250228201459202](https://raw.githubusercontent.com/DeutschBall/VideoBed/main/image-20250228201459202.png)

如果此次块标准化之后的输入不影响程序执行路径.

那么,这块就可以标准化

否则,快给我摆回来

接下来就顺次调整`set_pos`看下一个块能不能标准化

![image-20250228202426295](https://raw.githubusercontent.com/DeutschBall/VideoBed/main/image-20250228202426295.png)



### BLOCK DELETION

本操作旨在以块删除方式缩减输入

每轮设定一个步长,步长作为块单位,每删一块把剩下的拼起来作为输入,如果不影响执行路径则可以删去,否则给我摆回来

一轮结束后步长减半,重复上述流程,

最后步长为1时,如果一轮结束没有任何新的改动说明收敛了.结束流程.

![](https://raw.githubusercontent.com/DeutschBall/VideoBed/main/image-20250228210241092.png)



### ALPHABET MINIMIZATION

本操作旨在减少输入中的符号种类

遍历256个ASCII字符, 每次选定一个字符, 将BLOCK DELETION的结果中的所有该字符置‘0’,然后作为输入,如果不影响执行路径,则该字符可以删除

比如选定A字符, 将输入中的所有A替换为‘0’, 然后执行程序, 如果执行路径没变化, 则所有的A都是可以替代的



### CHARACTER MINIMIZATION

ALPHABET MINIMIZATION过程中, 某一个字符是一荣俱荣的,

比如`A…A…`,如果只有第一个A会影响执行路径, 后面的A不会影响, 但是也因为第一个A而赖活着

那么在本阶段中将杀掉这些滥竽充数的, 逐个字符进行筛查

遍历输入的每个字符, 改成‘0’后执行, 宁可执行一千, 也不放过一个









