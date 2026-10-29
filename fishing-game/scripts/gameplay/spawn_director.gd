class_name SpawnDirector
extends RefCounted

var event: EventDefinition = preload("res://resources/events/starwing_bonus.tres")
var timers: Dictionary = {"school": 1.0, "medium": 3.0, "large": 28.0, "shark": 145.0,
	"bonus": 45.0, "warning": 0.0, "reward": 0.0, "bonus_state": "waiting"}

func initialize(rng: RandomNumberGenerator) -> void:
	timers.shark = rng.randf_range(120, 180)
	timers.bonus = rng.randf_range(event.first_interval.x, event.first_interval.y)

func simulate(delta: float, basket_open: bool, fishes: Array[FishActor], catalog: GameCatalog, rng: RandomNumberGenerator, spawn: Callable) -> void:
	var counts: Dictionary = {"medium": 0, "large": 0, "shark": 0, "bonus": 0}
	var schools: Dictionary = {}
	var total: int = 0
	for fish: FishActor in fishes:
		if fish.state in [FishActor.State.REMOVED, FishActor.State.CAPTURED]:
			continue
		total += 1
		if fish.definition.spawn_kind == "school":
			schools[fish.school_id] = true
		else:
			counts[fish.definition.spawn_kind] = int(counts.get(fish.definition.spawn_kind, 0)) + 1
	for key: String in ["school", "medium", "large", "shark"]:
		timers[key] = maxf(0, float(timers[key]) - delta)
	match str(timers.bonus_state):
		"waiting":
			timers.bonus = maxf(0, float(timers.bonus) - delta)
			if float(timers.bonus) <= 0 and not basket_open and total < 60 and int(counts.shark) == 0:
				timers.bonus_state = "warning"
				timers.warning = event.warning_seconds
		"warning":
			timers.warning = maxf(0, float(timers.warning) - delta)
			if float(timers.warning) <= 0:
				spawn.call(catalog.fish.starwing_bonus, 1, 0)
				timers.bonus_state = "active"
				total += 1
		"active":
			if int(counts.bonus) == 0:
				_finish_bonus(rng)
		"rewarding":
			timers.reward = maxf(0, float(timers.reward) - delta)
			if float(timers.reward) <= 0:
				_finish_bonus(rng)
	var reserved: int = 1 if timers.bonus_state == "warning" else 0
	if float(timers.shark) <= 0 and int(counts.shark) == 0 and timers.bonus_state == "waiting" and float(timers.bonus) > 25 and total < 60 - reserved:
		spawn.call(catalog.fish.great_shark, 1, 0)
		timers.shark = rng.randf_range(120, 180)
		total += 1
	if float(timers.school) <= 0 and schools.size() < 3 and total < 45 - reserved:
		var fish: FishDefinition = catalog.fish[GameCatalog.FISH_IDS[rng.randi_range(0, 3)]]
		var count: int = mini(rng.randi_range(fish.group_range.x, fish.group_range.y), 59 - total - reserved)
		spawn.call(fish, count, rng.randi_range(0, 3))
		timers.school = rng.randf_range(7, 12)
		total += count
	if float(timers.medium) <= 0 and int(counts.medium) < 6 and total < 59 - reserved:
		var fish: FishDefinition = catalog.fish[GameCatalog.FISH_IDS[rng.randi_range(4, 7)]]
		var count: int = mini(rng.randi_range(fish.group_range.x, fish.group_range.y), 6 - int(counts.medium))
		spawn.call(fish, count, 1)
		timers.medium = rng.randf_range(5, 9)
		total += count
	if float(timers.large) <= 0 and int(counts.large) < 2 and total < 59 - reserved:
		spawn.call(catalog.fish.golden_grouper if rng.randf() < 0.6 else catalog.fish.manta_ray, 1, 0)
		timers.large = rng.randf_range(25, 40)

func start_reward() -> void:
	timers.bonus_state = "rewarding"
	timers.reward = event.reward_seconds

func _finish_bonus(rng: RandomNumberGenerator) -> void:
	timers.bonus_state = "waiting"
	timers.bonus = rng.randf_range(event.interval.x, event.interval.y)
