"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildTreeModel = exports.deepCloneTree = void 0;
/** 深拷贝一棵组件树。 */
function deepCloneTree(root) {
    const clone = { ...root };
    if (root.children !== undefined) {
        clone.children = root.children.map(deepCloneTree);
    }
    return clone;
}
exports.deepCloneTree = deepCloneTree;
/**
 * 校验并索引一棵树。
 * 校验失败（根非法、id 非字符串、id 重复）时抛出 Error。
 */
function buildTreeModel(root) {
    if (root === null || typeof root !== 'object' || Array.isArray(root)) {
        throw new Error('组件树根节点必须是对象');
    }
    const nodes = new Map();
    const parentOf = new Map();
    const childrenOf = new Map();
    const depthOf = new Map();
    const visit = (node, parentId, depth) => {
        if (node === null || typeof node !== 'object' || Array.isArray(node)) {
            throw new Error('组件节点必须是对象');
        }
        if (typeof node.id !== 'string' || node.id.length === 0) {
            throw new Error('组件节点缺少合法的字符串 id');
        }
        if (nodes.has(node.id)) {
            throw new Error(`组件 id 重复: ${node.id}`);
        }
        nodes.set(node.id, node);
        if (parentId !== null) {
            parentOf.set(node.id, parentId);
        }
        depthOf.set(node.id, depth);
        const rawChildren = node.children;
        const childIds = [];
        childrenOf.set(node.id, childIds);
        if (rawChildren === undefined) {
            return;
        }
        if (!Array.isArray(rawChildren)) {
            throw new Error(`组件 ${node.id} 的 children 必须是数组`);
        }
        for (const child of rawChildren) {
            visit(child, node.id, depth + 1);
            childIds.push(child.id);
        }
    };
    visit(root, null, 0);
    return { root, nodes, parentOf, childrenOf, depthOf };
}
exports.buildTreeModel = buildTreeModel;
