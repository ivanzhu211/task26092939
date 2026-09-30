import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ComponentNode,
  TreeOperation,
  diffTrees,
  applyOperation,
  applyOperations,
  cloneTree,
} from '../src/index';

/** 构造节点：node('a', node('b'), node('c')) */
function node(id: string, ...children: ComponentNode[]): ComponentNode {
  return children.length > 0 ? { id, children } : { id };
}

/** 归一化为仅含 id 与有序 children 的结构，用于深度比较。 */
function shape(root: ComponentNode): unknown {
  return {
    id: root.id,
    children: (root.children ?? []).map((child) => shape(child)),
  };
}

function collectIds(root: ComponentNode): string[] {
  const ids: string[] = [];
  const stack: ComponentNode[] = [root];
  while (stack.length > 0) {
    const current = stack.pop() as ComponentNode;
    ids.push(current.id);
    stack.push(...(current.children ?? []));
  }
  return ids;
}

function findNode(root: ComponentNode, id: string): ComponentNode | null {
  if (root.id === id) return root;
  for (const child of root.children ?? []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

/**
 * 逐步重放并校验：每个操作完成后都是合法单根树
 * （无重复 id、无脱离根的组件、组件集合与预期一致）。
 */
function replayWithChecks(oldRoot: ComponentNode, ops: readonly TreeOperation[]): ComponentNode {
  const working = cloneTree(oldRoot);
  const expected = new Set(collectIds(working));
  for (const op of ops) {
    if (op.type === 'add') {
      assert.ok(!expected.has(op.id), `add 的 id "${op.id}" 不应已存在`);
      expected.add(op.id);
    } else if (op.type === 'remove') {
      const target = findNode(working, op.id);
      assert.ok(target, `remove 的 id "${op.id}" 应存在`);
      for (const id of collectIds(target as ComponentNode)) {
        expected.delete(id);
      }
    }
    applyOperation(working, op); // 非法操作会在此抛错
    const ids = collectIds(working);
    assert.equal(ids.length, new Set(ids).size, `操作 ${JSON.stringify(op)} 后出现重复 id`);
    assert.deepEqual(
      new Set(ids),
      expected,
      `操作 ${JSON.stringify(op)} 后组件集合不符合预期（可能有组件脱离根）`,
    );
  }
  return working;
}

function countMoves(ops: readonly TreeOperation[]): number {
  return ops.filter((op) => op.type === 'move').length;
}

function byType(ops: readonly TreeOperation[], type: TreeOperation['type']): TreeOperation[] {
  return ops.filter((op) => op.type === type);
}

test('场景1：根下叶子 a,b,c,d -> b,x,d,a，新增x、删除c、恰好移动1次', () => {
  const oldTree = node('root', node('a'), node('b'), node('c'), node('d'));
  const newTree = node('root', node('b'), node('x'), node('d'), node('a'));

  const ops = diffTrees(oldTree, newTree);

  assert.equal(countMoves(ops), 1);
  assert.deepEqual(
    byType(ops, 'add').map((op) => (op.type === 'add' ? op.id : '')),
    ['x'],
  );
  assert.deepEqual(
    byType(ops, 'remove').map((op) => op.id),
    ['c'],
  );
  const replayed = replayWithChecks(oldTree, ops);
  assert.deepEqual(shape(replayed), shape(newTree));
});

test('场景2：root>a>b 与 root>b>a 互换，恰好2次移动且每步合法', () => {
  const oldTree = node('root', node('a', node('b')));
  const newTree = node('root', node('b', node('a')));

  const ops = diffTrees(oldTree, newTree);

  assert.equal(countMoves(ops), 2);
  assert.equal(ops.length, 2);
  const replayed = replayWithChecks(oldTree, ops); // 每步都校验合法性
  assert.deepEqual(shape(replayed), shape(newTree));
});

test('完全相同的快照产生空方案', () => {
  const oldTree = node('root', node('a', node('x')), node('b'));
  const newTree = node('root', node('a', node('x')), node('b'));
  assert.deepEqual(diffTrees(oldTree, newTree), []);
});

test('移动会携带整棵子树且只计1次', () => {
  const oldTree = node('root', node('a', node('x', node('y')), node('z')), node('b'));
  const newTree = node('root', node('b'), node('a', node('x', node('y')), node('z')));

  const ops = diffTrees(oldTree, newTree);

  assert.equal(countMoves(ops), 1);
  assert.equal(ops.length, 1);
  const replayed = replayWithChecks(oldTree, ops);
  assert.deepEqual(shape(replayed), shape(newTree));
});

test('混合场景：容器增删 + 跨层迁移 + 同层调序', () => {
  // old: root[ A[x,y], B[z], D ]  new: root[ D, B[y,x], C[z] ]
  const oldTree = node(
    'root',
    node('A', node('x'), node('y')),
    node('B', node('z')),
    node('D'),
  );
  const newTree = node(
    'root',
    node('D'),
    node('B', node('y'), node('x')),
    node('C', node('z')),
  );

  const ops = diffTrees(oldTree, newTree);

  // x、y：父组件 A->B 变化，各移动1次；z：B->C，移动1次；D：调序移动1次。
  assert.equal(countMoves(ops), 4);
  assert.deepEqual(
    byType(ops, 'add').map((op) => (op.type === 'add' ? op.id : '')),
    ['C'],
  );
  assert.deepEqual(
    byType(ops, 'remove').map((op) => op.id),
    ['A'],
  );
  const replayed = replayWithChecks(oldTree, ops);
  assert.deepEqual(shape(replayed), shape(newTree));
});

test('新增组件的父组件也是新增组件时，先建父再建子', () => {
  const oldTree = node('root', node('a'));
  const newTree = node('root', node('a'), node('P', node('c1', node('c2'))));

  const ops = diffTrees(oldTree, newTree);

  assert.equal(countMoves(ops), 0);
  assert.deepEqual(
    byType(ops, 'add').map((op) => (op.type === 'add' ? op.id : '')),
    ['P', 'c1', 'c2'],
  );
  const replayed = replayWithChecks(oldTree, ops);
  assert.deepEqual(shape(replayed), shape(newTree));
});

test('保留组件从被删除的子树中迁出后才执行删除', () => {
  // old: root[ A[keep, gone] ]  new: root[ keep ]
  const oldTree = node('root', node('A', node('keep'), node('gone')));
  const newTree = node('root', node('keep'));

  const ops = diffTrees(oldTree, newTree);

  assert.equal(countMoves(ops), 1); // keep: A -> root
  assert.deepEqual(
    byType(ops, 'remove').map((op) => op.id),
    ['A'],
  );
  const removeIndex = ops.findIndex((op) => op.type === 'remove');
  const moveIndex = ops.findIndex((op) => op.type === 'move');
  assert.ok(moveIndex < removeIndex, '必须先迁出保留组件再删除旧子树');
  const replayed = replayWithChecks(oldTree, ops);
  assert.deepEqual(shape(replayed), shape(newTree));
});

test('传入的两份快照在 diff 与重放后均不被修改', () => {
  const oldTree = node('root', node('a', node('b')), node('c'));
  const newTree = node('root', node('c'), node('a', node('d')), node('b'));
  const oldSnapshot = JSON.stringify(oldTree);
  const newSnapshot = JSON.stringify(newTree);

  const ops = diffTrees(oldTree, newTree);
  applyOperations(oldTree, ops);

  assert.equal(JSON.stringify(oldTree), oldSnapshot);
  assert.equal(JSON.stringify(newTree), newSnapshot);
});

test('非法操作在重放时抛错', () => {
  const tree = node('root', node('a', node('b')));
  assert.throws(
    () => applyOperation(cloneTree(tree), { type: 'move', id: 'a', parentId: 'b', index: 0 }),
    /后代/,
  );
  assert.throws(
    () => applyOperation(cloneTree(tree), { type: 'add', id: 'a', parentId: 'root', index: 0, node: { id: 'a' } }),
    /重复|已存在/,
  );
  assert.throws(
    () => applyOperation(cloneTree(tree), { type: 'remove', id: 'root' }),
    /根/,
  );
  assert.throws(
    () => applyOperation(cloneTree(tree), { type: 'move', id: 'root', parentId: 'a', index: 0 }),
    /根/,
  );
});

/* ---------- 随机化性质测试：重放结果必须等于目标，且移动次数等于理论下界 ---------- */

/** 与库无关的下界计算：父组件变化数 + 每个父组件下同层保留组件数 - LCS 长度。 */
function lowerBoundMoves(oldRoot: ComponentNode, newRoot: ComponentNode): number {
  const parentOf = (root: ComponentNode): Map<string, string | null> => {
    const map = new Map<string, string | null>();
    const walk = (n: ComponentNode): void => {
      for (const c of n.children ?? []) {
        map.set(c.id, n.id);
        walk(c);
      }
    };
    map.set(root.id, null);
    walk(root);
    return map;
  };
  const oldParent = parentOf(oldRoot);
  const newParent = parentOf(newRoot);
  const kept = [...oldParent.keys()].filter((id) => newParent.has(id));

  let bound = 0;
  for (const id of kept) {
    if (id !== oldRoot.id && oldParent.get(id) !== newParent.get(id)) bound++;
  }
  const childrenOf = (root: ComponentNode): Map<string, string[]> => {
    const map = new Map<string, string[]>();
    const walk = (n: ComponentNode): void => {
      map.set(n.id, (n.children ?? []).map((c) => c.id));
      for (const c of n.children ?? []) walk(c);
    };
    walk(root);
    return map;
  };
  const oldChildren = childrenOf(oldRoot);
  const newChildren = childrenOf(newRoot);
  for (const [parentId, newKids] of newChildren) {
    const oldKids = oldChildren.get(parentId);
    if (!oldKids) continue;
    const oldOrder = oldKids.filter((id) => kept.includes(id) && newParent.get(id) === parentId);
    const newOrder = newKids.filter((id) => kept.includes(id) && oldParent.get(id) === parentId);
    // LCS 长度（元素唯一，动态规划即可）。
    const m = oldOrder.length;
    const n = newOrder.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] =
          oldOrder[i - 1] === newOrder[j - 1]
            ? dp[i - 1][j - 1] + 1
            : Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
    bound += m - dp[m][n];
  }
  return bound;
}

/** 简单可复现的伪随机数生成器。 */
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/** 用给定 id 列表随机组装一棵树（root 固定为第一个 id）。 */
function randomTree(ids: string[], rand: () => number): ComponentNode {
  const root: ComponentNode = { id: ids[0] };
  const placed: ComponentNode[] = [root];
  for (let i = 1; i < ids.length; i++) {
    const parent = placed[Math.floor(rand() * placed.length)];
    const child: ComponentNode = { id: ids[i] };
    const siblings = (parent.children ??= []);
    siblings.splice(Math.floor(rand() * (siblings.length + 1)), 0, child);
    placed.push(child);
  }
  return root;
}

test('随机快照：重放等于目标，移动次数等于理论下界，每步合法', () => {
  const rand = lcg(20261001);
  for (let round = 0; round < 200; round++) {
    const total = 2 + Math.floor(rand() * 11); // 2~12 个组件
    const allIds = Array.from({ length: total }, (_, i) => (i === 0 ? 'root' : `n${i}`));
    // 随机划分：保留 / 旧独有 / 新独有（root 始终保留）。
    const keptIds = allIds.filter((id) => id === 'root' || rand() < 0.7);
    const oldOnly = allIds.filter((id) => id !== 'root' && !keptIds.includes(id) && rand() < 0.5);
    const newOnlyCount = Math.floor(rand() * 4);
    const newOnly = Array.from({ length: newOnlyCount }, (_, i) => `x${round}_${i}`);
    const shuffle = (arr: string[]): string[] => {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    };
    // randomTree 以第一个 id 为根，root 必须固定在首位。
    const withRoot = (ids: string[]): string[] => [
      'root',
      ...shuffle(ids.filter((id) => id !== 'root')),
    ];
    const oldTree = randomTree(withRoot([...keptIds, ...oldOnly]), rand);
    const newTree = randomTree(withRoot([...keptIds, ...newOnly]), rand);

    const ops = diffTrees(oldTree, newTree);
    const replayed = replayWithChecks(oldTree, ops);
    assert.deepEqual(shape(replayed), shape(newTree), `第 ${round} 轮重放结果与目标不一致`);
    assert.equal(
      countMoves(ops),
      lowerBoundMoves(oldTree, newTree),
      `第 ${round} 轮移动次数未达到理论下界`,
    );
  }
});
