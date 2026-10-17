// 高度差以飞机位置为基准，不掺入眼位、模型放大或符号示意偏移。
export function relativeHeightLabel(targetY, ownY) {
  const height = Math.round(targetY - ownY);
  return `${height === 0 ? '↔' : height > 0 ? '↑' : '↓'} ${Math.abs(height)} m`;
}

export function trafficDistanceLabel(distance) {
  return distance < 1000 ? `${Math.round(distance)} m` : `${(distance / 1000).toFixed(1)} km`;
}
