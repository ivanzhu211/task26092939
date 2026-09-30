# component-tree-diff

页面组件树的结构差异库，供上层编辑器直接调用。输入旧、新两份 JSON 快照，
生成一份**移动次数全局最少**的结构编辑方案，并支持按方案依次重放，
用于版本差异展示与恢复预览。全部计算在内存中完成，不修改调用方传入的快照。

## 构建与测试

```bash
npm run build   # 使用全局 tsc 编译到 dist/
npm test        # 编译并运行 node:test 测试
```

## API

```ts
import { diffTrees, applyOperations, applyOperation, cloneTree } from 'component-tree-diff';

// 1. 生成结构编辑方案（只含 add / remove / move，move 次数全局最少）
const ops = diffTrees(oldSnapshot, newSnapshot);

// 2. 按方案依次修改旧快照，返回重放后的新树（旧快照不被修改）
const replayed = applyOperations(oldSnapshot, ops);
// replayed 的组件集合、父子关系、每个父组件下的排列顺序与 newSnapshot 完全一致
```

### 数据模型

```ts
interface ComponentNode {
  id: string;                    // 稳定 ID，同一版本内不重复
  children?: ComponentNode[];    // 有序子组件
  [key: string]: unknown;        // 其余业务字段原样保留
}

type TreeOperation =
  | { type: 'add';    id: string; parentId: string; index: number; node: ComponentNode }
  | { type: 'remove'; id: string }
  | { type: 'move';   id: string; parentId: string; index: number };
```

- `add`：在 `parentId` 下 `index` 处创建新快照独有的组件，创建时不带子组件。
- `remove`：移除该组件及其当前整棵子树（子树内均为旧快照独有的 ID）。
- `move`：把组件及其当前整棵子树移到 `parentId` 下；`index` 是先从当前位置
  摘下、再插入时的下标。跨父迁移与同父调序都计 1 次移动，被携带的后代不另计。

## 最少移动的判定规则

1. 父组件发生变化的保留组件必须移动（只有自身移动才能改变父组件）；
2. 父组件未变的同层组件中，相对顺序与旧快照不一致的必须移动
   （每个父组件下保留 `旧顺序 ∩ 新顺序` 的最长公共子序列不移动，其余各移动 1 次）。

二者之和是移动次数的下界；本方案对恰好这个集合各移动一次，达到全局最少。
操作按新快照先序遍历发出（父先于子、兄先于弟），保证每个操作完成后都是
合法单根树；删除全部放在最后，且保留组件会先迁出被删子树。

## 重放校验

`applyOperation` 对每个操作做合法性校验，非法时抛错且树保持未修改：
重复 ID、父组件不存在、下标越界、删除/移动根组件、
把组件移动到自己或自己的后代下面等。
