# [Syzkaller IV]syz-sysgen





syz-sysgen



解码器

```go
package main

import (
	"bytes"
	"compress/flate"
	"encoding/gob"
	"fmt"
	"io/ioutil"

	"github.com/google/syzkaller/sys/generated"
)

func main() {
	// if len(os.Args) < 2 {
	// 	fmt.Println("Usage: go run inspect_gob.go <path_to_gob_flate_file>")
	// 	return
	// }
	filename := "/usr/src/syzkaller/sys/gen/linux_amd64.gob.flate"
	// filename := os.Args[1]
	data, err := ioutil.ReadFile(filename)
	if err != nil {
		panic(err)
	}

	// 1. 解压缩 (flate)
	// 2. 解码 (gob)
	desc := new(generated.Desc)
	if err := gob.NewDecoder(flate.NewReader(bytes.NewReader(data))).Decode(desc); err != nil {
		panic(err)
	}

	// 3. 打印内容
	fmt.Printf("Loaded %d syscalls\n", len(desc.Syscalls))
	for _, call := range desc.Syscalls {
		fmt.Printf("Syscall: %s (ID: %d)\n", call.Name, call.ID)
		for _, arg := range call.Args {
			fmt.Printf("  Arg: %s (Type: %T)\n", arg.Name, arg.Type)
		}
	}
}

```

