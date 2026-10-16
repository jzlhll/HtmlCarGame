const htmlValues = new WeakMap(), bilingualNodes = new WeakMap();

export function setText(element, value) {
  const text = String(value);
  if (element.textContent !== text) element.textContent = text;
}

export function setHTML(element, value) {
  if (htmlValues.get(element) === value) return;
  htmlValues.set(element, value); bilingualNodes.delete(element);
  element.innerHTML = value;
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
