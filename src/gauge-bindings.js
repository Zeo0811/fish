// A rig signature describes a layout, not the live Node instances behind it.
// Recasts rebuild Nodes even when every weight and spacing stays the same.
export function sameGaugeBinding(previous, current, previousSignature, signature) {
  return previousSignature === signature && previous.length === current.length &&
    current.every((node, i) => previous[i] === node);
}
