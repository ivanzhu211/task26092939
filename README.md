# component-tree-diff

页面组件树的结构差异库，供上层编辑器直接调用。输入两份 JSON 快照（同一固定根组件的有序组件树），
输出一份尽量简短、可逐步重放的结构编辑方案，用于版本差异展示与恢复预览。数据只在内存中处理。

## API

```ts
import { diffComponentTrees, applyOperations } from 'component-tree-diff';

const ops = diffComponentTrees(oldTree, newTree); // Operation[]
const result = applyOperations(oldTree, ops);     // 与 newTree 结构完全一致
```

- `diffComponentTrees(oldTree, newTree)`：生成编辑方案，不修改入参。
- `applyOperations(baseTree, operations)`：依次重放并返回新树，不修改 `baseTree`；
  每个操作执行后都校验仍是合法单根树（无重复 id、无环、无脱离根的组件），非法即抛错。

## 操作类型

- `add`：在已有父组件的指定位置创建一个新快照独有的组件（不带子组件，携带自身数据）。
- `remove`：删除组件及其当前整棵子树（被删除的 id 都是旧快照独有的）。
- `move`：把组件及其当前整棵子树放到已有父组件的指定位置，子树内部关系与顺序保持不变。

## 移动次数的全局最少性

- 两边都出现但父组件不同的组件，只能靠自己移动一次来改变父子关系，次数不可省。
- 父组件相同的组件之间，未被移动的相对顺序在重放中不会被其他操作改变，
  因此每个父组件下至少移动 `n - LCS(旧顺序, 新顺序)` 次。
- 本库恰好达到这个下界：跨父迁移各计 1 次；同父调序保留一个最长公共子序列不动，其余各移 1 次；
  被携带的后代不另计。新增、删除不计入移动次数。

方案生成顺序为：先自顶向下新增（保证父组件存在），再按目标深度自顶向下移动
（保证不会把组件移到自己或后代下面），最后删除最外层的待删子树。

## 开发

```sh
npm run build   # tsc 编译到 dist/
npm test        # 编译并运行 node:test 测试
```
