class_name ShotSystem
extends Node2D

const WATER: Rect2 = Rect2(40, 102, 1520, 664)
var shots: Array[Dictionary] = []

func launch(id: int, start: Vector2, direction: Vector2, net: Dictionary) -> void:
	shots.append({"id": id, "position": [start.x, start.y], "direction": [direction.x, direction.y], "net": net.duplicate(true), "life": 3.0})

func simulate(delta: float, fishes: Array[FishActor], resolve: Callable) -> void:
	# 数组始终按 shot_id 的发射顺序处理，同一物理步内结算稳定。
	var remaining: Array[Dictionary] = []
	for shot: Dictionary in shots:
		var start: Vector2 = Vector2(shot.position[0], shot.position[1])
		var direction: Vector2 = Vector2(shot.direction[0], shot.direction[1])
		var end: Vector2 = start + direction * 860 * delta
		var nearest: float = 2.0
		for fish: FishActor in fishes:
			if not fish.can_capture():
				continue
			var polygon: PackedVector2Array = fish.collision_polygon()
			if Geometry2D.is_point_in_polygon(start, polygon):
				nearest = 0.0
			for index: int in range(polygon.size()):
				var point: Variant = Geometry2D.segment_intersects_segment(start, end, polygon[index], polygon[(index + 1) % polygon.size()])
				if point != null:
					var fraction: float = start.distance_to(point) / maxf(0.001, start.distance_to(end))
					nearest = minf(nearest, fraction)
		shot.life = maxf(0.0, float(shot.life) - delta)
		var impact: bool = nearest <= 1.0
		if impact:
			end = start.lerp(end, nearest)
		elif not WATER.has_point(end):
			# 取本步与水面边界的交点，不能让炮弹穿越操作栏。
			var ratio: float = 1.0
			if end.x < WATER.position.x:
				ratio = minf(ratio, (WATER.position.x - start.x) / (end.x - start.x))
			if end.x > WATER.end.x:
				ratio = minf(ratio, (WATER.end.x - start.x) / (end.x - start.x))
			if end.y < WATER.position.y:
				ratio = minf(ratio, (WATER.position.y - start.y) / (end.y - start.y))
			if end.y > WATER.end.y:
				ratio = minf(ratio, (WATER.end.y - start.y) / (end.y - start.y))
			end = start.lerp(end, clampf(ratio, 0, 1))
			impact = true
		if impact or float(shot.life) <= 0:
			resolve.call(end, shot.net)
		else:
			shot.position = [end.x, end.y]
			remaining.append(shot)
	shots = remaining
	queue_redraw()

func _draw() -> void:
	for shot: Dictionary in shots:
		var p: Vector2 = Vector2(shot.position[0], shot.position[1])
		var direction: Vector2 = Vector2(shot.direction[0], shot.direction[1])
		var color: Color = Color.html(shot.net.color)
		draw_line(p - direction * 25, p, Color(color, 0.3), 6, true)
		draw_circle(p, 7, color)
		draw_circle(p - direction * 1.5, 3, Color("fff7d8"))
