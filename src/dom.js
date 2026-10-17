const chineseRuns=/([\p{Script=Han}，。；：？！、（）《》“”]+)/gu;

// 只包裹中文文字，英文与数字保持原字号；仅在文案改变时处理，不逐帧扫描界面。
export function enlargeChinese(root) {
  if (root.nodeType!==1 || root.closest('cjk-text')) return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT), nodes=[];
  while (walker.nextNode()) {
    const node=walker.currentNode;
    if (!node.parentElement.closest('cjk-text,svg,script,style') && /\p{Script=Han}/u.test(node.data)) nodes.push(node);
  }
  for (const node of nodes) {
    const fragment=document.createDocumentFragment();
    for (const [index,text] of node.data.split(chineseRuns).entries()) {
      if (!text) continue;
      if (index%2) { const copy=document.createElement('cjk-text');copy.lang='zh-CN';copy.textContent=text;fragment.append(copy); }
      else fragment.append(document.createTextNode(text));
    }
    const run=document.createElement('text-run');run.append(fragment);node.replaceWith(run);
  }
}

const htmlValues = new WeakMap(), bilingualNodes = new WeakMap();

export function setText(element, value) {
  const text = String(value);
  if (element.textContent !== text) {
    // 整体替换会移除双语子节点，后续必须重新绑定，避免更新已脱离页面的节点。
    bilingualNodes.delete(element); htmlValues.delete(element);
    element.textContent = text; enlargeChinese(element);
  }
}

export function setHTML(element, value) {
  if (htmlValues.get(element) === value) return;
  htmlValues.set(element, value); bilingualNodes.delete(element);
  element.innerHTML = value; enlargeChinese(element);
}

// 双语标签保留文本节点和辅助标签，只更新实际变化的文字。
export function setBilingual(element, primary, secondary) {
  let nodes = bilingualNodes.get(element);
  if (!nodes) {
    const text = document.createTextNode(''), small = document.createElement('small');
    element.replaceChildren(text, small); nodes = {text, small}; bilingualNodes.set(element, nodes);
    htmlValues.delete(element);
  }
  setText(nodes.text, primary); setText(nodes.small, secondary);
}
