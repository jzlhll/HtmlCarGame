class_name CaptureResolver
extends RefCounted

func covered(fish: FishActor, center: Vector2, radius: float) -> bool:
	if not fish.can_capture():
		return false
	var polygon: PackedVector2Array = fish.collision_polygon()
	if Geometry2D.is_point_in_polygon(center, polygon):
		return true
	for index: int in range(polygon.size()):
		var nearest: Vector2 = Geometry2D.get_closest_point_to_segment(center, polygon[index], polygon[(index + 1) % polygon.size()])
		if nearest.distance_squared_to(center) <= radius * radius:
			return true
	return false

func succeeds(fish: FishActor, net: Dictionary, rng: RandomNumberGenerator) -> bool:
	if fish.definition.reward_mode == "bonus_direct":
		return true
	return rng.randf() < clampf(fish.definition.p_base * float(net.probability_factor), 0, 0.95)
