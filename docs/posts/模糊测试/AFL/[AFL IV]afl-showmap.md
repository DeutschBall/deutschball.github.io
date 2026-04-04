---
title: AFL IV - afl-showmap
date: 2025-04-22 13:13:00
tags: 模糊测试
mathjax: true







---







# [AFL IV] afl-showmap





This tool displays raw tuple data captured by AFL instrumentation.

afl-showmap这个工具用来打印 一次程序执行过程中 被命中的执行路径

从这个工具中能看出, 执行路径是以什么方式存储的

## 举个🌰

还是以统计输入前缀中的‘a’个数为例子

```c
┌──(root㉿Destroyer)-[/home/dustball/testafl]
└─# cat test.c
#include <stdio.h>
#include <unistd.h>

int main(void) {
    char s[50];
    read(0, s, 100);

    int len = -1;

    do {
        len++;
    } while(s[len] == 'a');

    printf("%d\n", len);

    return 0;
}

```

```
afl-gcc -O0 -g test.c -o test 
```

```
echo 'aaaaaaaabbc' > in
```

```
 afl-showmap -o trace -- ./test < ./in
```

 afl-showmap的 打印效果 是`<路径哈希值:命中次数桶>`元组

```c
┌──(root㉿Destroyer)-[/home/dustball/testafl]
└─# cat trace
033209:1
040822:1
044147:1
044520:5
```

> 注意这里打印的是命中次数**桶**,不是命中次数
>
> 044520这条路径命中8,9,…,15次都会打印为5
>
> 命中4,5,6,7次会打印4



## 🧄法分析

afl系列工具的老套路, afl-showmap先处理命令行参数, 然后建立共享内存, 然后执行一次程序, 然后就应该打印命中的执行路径了

```c
  run_target(use_argv);
  tcnt = write_results();
```

在write_results中

```c
//u8* trace_bits = shmat(shm_id, NULL, 0); 就是共享内存, 用于记录执行路径

	for (i = 0; i < MAP_SIZE; i++) {	//64K

      if (!trace_bits[i]) continue;	//trace_bits[i] = 0 则表明: 哈希值为 i 的执行路径 没有被命中过
      ret++; 

      if (cmin_mode) {

        if (child_timed_out) break;
        if (!caa && child_crashed != cco) break;

        fprintf(f, "%u%u\n", trace_bits[i], i);

      } else fprintf(f, "%06u:%u\n", i, trace_bits[i]);	//哈希值为i的执行路径, 被命中次数为trace_bits[i]

    }
```

trace_bits中的值是谁填写的呢?showmap中显然没有写操作.

![image-20250301101016960](https://raw.githubusercontent.com/DeutschBall/VideoBed/main/image-20250301101016960.png)

可以这个trace_bits由afl-showmap创建, 之后afl-showmap对trace_bits只有读操作, 至于如何记录, 这是**目标程序中的afl桩**要干的事情



```c
//桩干的事情:
  current_path = _afl_prev_loc ^ _afl_current_loc;
  _afl_prev_loc = _afl_current_loc;             
  _afl_prev_loc = _afl_prev_loc >> 1;
  ++trace_bits[current_path];
```

在目标程序执行完之后, afl-showmap会遍历一遍trace_bits, 进行一个按桶分类

```c
  classify_counts(trace_bits, binary_mode ?
                  count_class_binary : count_class_human);
```

```c
static void classify_counts(u8* mem, const u8* map) {

  u32 i = MAP_SIZE;	//从后往前遍历

  if (edges_only) {	//只记录有没有命中, 不统计命中次数

    while (i--) {
      if (*mem) *mem = 1;
      mem++;
    }

  } else {

    while (i--) {	
      *mem = map[*mem];	//将实际的命中次数*mem经过map映射一下
      mem++;
    }

  }

}
```

这个桶实际上就是一个映射:

```c
static const u8 count_class_human[256] = {

  [0]           = 0,
  [1]           = 1,
  [2]           = 2,
  [3]           = 3,
  [4 ... 7]     = 4,
  [8 ... 15]    = 5,
  [16 ... 31]   = 6,
  [32 ... 127]  = 7,
  [128 ... 255] = 8			//总共有8种桶, 这个映射也就是将命中次数转化为桶编号

};

static const u8 count_class_binary[256] = {

  [0]           = 0,
  [1]           = 1,
  [2]           = 2,
  [3]           = 4,
  [4 ... 7]     = 8,
  [8 ... 15]    = 16,
  [16 ... 31]   = 32,
  [32 ... 127]  = 64,
  [128 ... 255] = 128		//总共有8个桶,这个映射也就是将命中次数映射为一个代表命中数字

};
```

因此经过`count_class_human`的映射后, 假设某条路径命中次数为7, 那么实际得到的`trace_bits`值就是4, 意思是落到了第4个桶里

至于为甚么只记录8个桶子, 命中次数最大值是255

这是因为trace_bits以字节为单元, 一个字节代表一个执行路径元组. 一个字节最多就能表示[0,255],再命中一次就会整数上溢, 回绕到0

但是开发者认为可以为了性能牺牲这个准确性, 凑活着用吧









