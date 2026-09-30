"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const index_1 = require("../src/index");
/** 用紧凑写法构造组件树：t('a', t('b')) 表示 a 下有 b。 */
function t(id, ...children) {
    return children.length > 0 ? { id, children } : { id };
}
/** 提取树的结构（仅 id 与层级顺序），用于比较。 */
function shape(node) {
    return {
        id: node.id,
        children: (node.children ?? []).map(shape),
    };
}
function countMoves(ops) {
    return ops.filter((op) => op.type === 'move').length;
}
function opsOfType(ops, type) {
    return ops.filter((op) => op.type === type);
}
/**  diff + 重放，断言结果与目标结构一致，返回操作方案。 */
function replay(oldTree, newTree) {
    const ops = (0, index_1.diffComponentTrees)(oldTree, newTree);
    const result = (0, index_1.applyOperations)(oldTree, ops);
    strict_1.default.deepEqual(shape(result), shape(newTree), '重放结果必须与目标一致');
    return ops;
}
(0, node_test_1.test)('叶子调序：a,b,c,d -> b,x,d,a，新增 x、删除 c、恰好移动 1 次', () => {
    const oldTree = t('root', t('a'), t('b'), t('c'), t('d'));
    const newTree = t('root', t('b'), t('x'), t('d'), t('a'));
    const ops = replay(oldTree, newTree);
    const adds = opsOfType(ops, 'add');
    strict_1.default.equal(adds.length, 1);
    strict_1.default.equal(adds[0].id, 'x');
    strict_1.default.equal(adds[0].parentId, 'root');
    const removes = opsOfType(ops, 'remove');
    strict_1.default.equal(removes.length, 1);
    strict_1.default.equal(removes[0].id, 'c');
    strict_1.default.equal(countMoves(ops), 1);
});
(0, node_test_1.test)('父子互换：root>a>b -> root>b>a，恰好 2 次移动且每步都是合法树', () => {
    const oldTree = t('root', t('a', t('b')));
    const newTree = t('root', t('b', t('a')));
    const ops = (0, index_1.diffComponentTrees)(oldTree, newTree);
    strict_1.default.equal(ops.length, 2);
    strict_1.default.equal(countMoves(ops), 2);
    // 逐个重放：每个操作完成后都必须是合法单根树（applyOperations 内部逐步校验）
    for (let i = 1; i <= ops.length; i++) {
        (0, index_1.applyOperations)(oldTree, ops.slice(0, i));
    }
    const result = (0, index_1.applyOperations)(oldTree, ops);
    strict_1.default.deepEqual(shape(result), shape(newTree));
});
(0, node_test_1.test)('完全相同的树不需要任何操作', () => {
    const oldTree = t('root', t('a', t('b')), t('c'));
    const newTree = t('root', t('a', t('b')), t('c'));
    strict_1.default.deepEqual((0, index_1.diffComponentTrees)(oldTree, newTree), []);
});
(0, node_test_1.test)('新增容器：把既有组件移入新容器，容器本身由 add 创建', () => {
    const oldTree = t('root', t('a'), t('b'), t('c'));
    const newTree = t('root', t('wrap', t('a'), t('b')), t('c'));
    const ops = replay(oldTree, newTree);
    const adds = opsOfType(ops, 'add');
    strict_1.default.equal(adds.length, 1);
    strict_1.default.equal(adds[0].id, 'wrap');
    strict_1.default.equal(countMoves(ops), 2); // a、b 各移动一次
    strict_1.default.equal(opsOfType(ops, 'remove').length, 0);
});
(0, node_test_1.test)('删除容器：子组件先移出，容器随整棵子树删除', () => {
    const oldTree = t('root', t('wrap', t('a'), t('b')), t('c'));
    const newTree = t('root', t('a'), t('b'), t('c'));
    const ops = replay(oldTree, newTree);
    const removes = opsOfType(ops, 'remove');
    strict_1.default.equal(removes.length, 1);
    strict_1.default.equal(removes[0].id, 'wrap');
    strict_1.default.equal(countMoves(ops), 2); // a、b 各移动一次
});
(0, node_test_1.test)('移动携带整棵子树，被携带的后代不另计移动', () => {
    const oldTree = t('root', t('a', t('b', t('c'))), t('d'));
    const newTree = t('root', t('d'), t('a', t('b', t('c'))));
    const ops = replay(oldTree, newTree);
    strict_1.default.equal(countMoves(ops), 1); // 仅 a 移动一次，b、c 被携带
});
(0, node_test_1.test)('混合场景：调序 + 跨层迁移 + 容器增删同时发生', () => {
    const oldTree = t('root', t('header', t('logo'), t('nav')), t('main', t('hero'), t('list', t('item1'), t('item2'))), t('footer'), t('banner'));
    const newTree = t('root', t('main', t('list', t('item2'), t('item1'), t('item3')), t('hero')), t('sidebar', t('nav')), t('header', t('logo')), t('footer'));
    const ops = replay(oldTree, newTree);
    // 新增：sidebar、item3；删除：banner
    strict_1.default.deepEqual(opsOfType(ops, 'add')
        .map((op) => op.id)
        .sort(), ['item3', 'sidebar']);
    strict_1.default.deepEqual(opsOfType(ops, 'remove').map((op) => op.id), ['banner']);
    // 移动：item1/item2 调序取 LCS 需 1 次；nav 跨父迁移 1 次；
    // main 与 header 调序（root 下 LCS 可保留 main/footer 或 header/footer）1 次；
    // list 与 hero 调序 1 次
    strict_1.default.equal(countMoves(ops), 4);
});
(0, node_test_1.test)('逆序重排：a,b,c,d -> d,c,b,a 需要 3 次移动', () => {
    const oldTree = t('root', t('a'), t('b'), t('c'), t('d'));
    const newTree = t('root', t('d'), t('c'), t('b'), t('a'));
    const ops = replay(oldTree, newTree);
    strict_1.default.equal(countMoves(ops), 3); // 4 - LCS(长度 1)
});
(0, node_test_1.test)('新增组件携带的自有数据在重放后保留', () => {
    const oldTree = t('root', t('a'));
    const newTree = {
        id: 'root',
        children: [
            { id: 'a' },
            { id: 'card', props: { title: '促销', sku: [1, 2] }, children: [] },
        ],
    };
    const ops = (0, index_1.diffComponentTrees)(oldTree, newTree);
    const result = (0, index_1.applyOperations)(oldTree, ops);
    const card = result.children[1];
    strict_1.default.equal(card.id, 'card');
    strict_1.default.deepEqual(card.props, { title: '促销', sku: [1, 2] });
    strict_1.default.deepEqual(card.children, undefined);
});
(0, node_test_1.test)('diff 与重放都不会修改调用方提供的快照', () => {
    const oldTree = t('root', t('a', t('b')), t('c'));
    const newTree = t('root', t('c'), t('x', t('b')), t('a'));
    const oldSnapshot = JSON.parse(JSON.stringify(oldTree));
    const newSnapshot = JSON.parse(JSON.stringify(newTree));
    const ops = (0, index_1.diffComponentTrees)(oldTree, newTree);
    (0, index_1.applyOperations)(oldTree, ops);
    strict_1.default.deepEqual(oldTree, oldSnapshot);
    strict_1.default.deepEqual(newTree, newSnapshot);
});
(0, node_test_1.test)('根组件不一致时拒绝生成方案', () => {
    strict_1.default.throws(() => (0, index_1.diffComponentTrees)(t('rootA'), t('rootB')), /根/);
});
(0, node_test_1.test)('同一快照内 id 重复时拒绝', () => {
    const bad = { id: 'root', children: [{ id: 'a' }, { id: 'a' }] };
    strict_1.default.throws(() => (0, index_1.diffComponentTrees)(bad, t('root')), /重复/);
});
(0, node_test_1.test)('重放非法操作会抛错：重复 id、移动根、移到后代下', () => {
    const base = t('root', t('a', t('b')));
    strict_1.default.throws(() => (0, index_1.applyOperations)(base, [{ type: 'add', id: 'a', parentId: 'root', index: 0, node: { id: 'a' } }]), /已存在/);
    strict_1.default.throws(() => (0, index_1.applyOperations)(base, [{ type: 'move', id: 'root', parentId: 'a', index: 0 }]), /根/);
    strict_1.default.throws(() => (0, index_1.applyOperations)(base, [{ type: 'move', id: 'a', parentId: 'b', index: 0 }]), /后代/);
    strict_1.default.throws(() => (0, index_1.applyOperations)(base, [{ type: 'remove', id: 'root' }]), /根/);
});
