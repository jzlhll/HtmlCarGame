class_name GameSession
extends Node2D

enum State { PLAYING, PAUSED, SAVING_ERROR, LOAD_ERROR }
var state: State = State.PLAYING
var catalog: GameCatalog
var economy: EconomyService = EconomyService.new()
var saves: SaveRepository = SaveRepository.new()
var inputs: InputRouter = InputRouter.new()
var resolver: CaptureResolver = CaptureResolver.new()
var director: SpawnDirector = SpawnDirector.new()
var rng: RandomNumberGenerator = RandomNumberGenerator.new()
var cannon: CannonController
var shots: ShotSystem
var effects: EffectsDirector
var seabed: SeabedView
var hud: HudController
var fish_layer: Node2D
var fishes: Array[FishActor] = []
var next_id: int = 1
var clock: float = 0
var save_elapsed: float = 0
var dirty: bool = false
var pending_feedback: Array[Callable] = []
var notice_cooldown: float = 0
var last_bonus_state: String = "waiting"
var portrait: bool = false
var quitting: bool = false
var mobile_safe_rect: Rect2 = Rect2(0, 0, 1600, 900)

func _ready() -> void:
	get_tree().auto_accept_quit = false
	catalog = GameCatalog.new()
	rng.randomize()
	seabed = SeabedView.new()
	add_child(seabed)
	fish_layer = Node2D.new()
	add_child(fish_layer)
	shots = ShotSystem.new()
	add_child(shots)
	cannon = CannonController.new()
	add_child(cannon)
	effects = EffectsDirector.new()
	add_child(effects)
	var ui: CanvasLayer = CanvasLayer.new()
	add_child(ui)
	hud = HudController.new()
	hud.catalog = catalog
	hud.mobile = inputs.mobile
	ui.add_child(hud)
	hud.net_selected.connect(_select_net)
	hud.basket_toggled.connect(_toggle_basket)
	hud.sell_requested.connect(_sell)
	hud.menu_requested.connect(_menu)
	hud.setting_changed.connect(_setting)
	effects.coin_arrived.connect(func() -> void: hud.wallet_pulse = 0.22)
	_load_game()
	get_viewport().size_changed.connect(_check_orientation)
	_check_orientation()

func _load_game() -> void:
	var loaded: Dictionary = saves.read_save()
	if not saves.last_error.is_empty():
		state = State.LOAD_ERROR
		hud.show_menu("load_error", saves.last_error)
		return
	if loaded.is_empty():
		_new_game()
		return
	economy.data = loaded
	_restore(loaded.session_snapshot)
	economy.data.selected_net_id = catalog.net_by_id(str(economy.data.selected_net_id)).id
	_apply_settings()
	hud.refresh(economy.data, economy.inventory_count())
	hud.close_menu()
	state = State.PLAYING
	inputs.clear()
	if not saves.recovery_message.is_empty():
		hud.toast(saves.recovery_message)

func _new_game() -> void:
	_clear_world()
	economy.new_game()
	rng.randomize()
	next_id = 1
	clock = 0
	director = SpawnDirector.new()
	director.initialize(rng)
	cannon.angle = 0
	cannon.cooldown = 0
	_spawn(catalog.fish.golden_grouper, 1, 0)
	if not fishes.is_empty():
		fishes[0].position.x = 680
		fishes[0].origin.x = 680
		fishes[0].state = FishActor.State.SWIMMING
	state = State.PLAYING
	hud.close_menu()
	_apply_settings()
	dirty = true
	_flush()

func _clear_world() -> void:
	for fish: FishActor in fishes:
		fish.queue_free()
	fishes.clear()
	shots.shots.clear()
	pending_feedback.clear()

func _restore(snap: Dictionary) -> void:
	_clear_world()
	next_id = int(snap.next_id)
	clock = float(snap.clock)
	rng.state = int(str(snap.rng_state))
	cannon.angle = float(snap.cannon_angle)
	cannon.cooldown = float(snap.cooldown)
	director.timers = snap.director.duplicate(true)
	for data: Dictionary in snap.fish:
		var fish: FishActor = FishActor.new()
		fish.setup(catalog.fish[data.definition], data)
		fish_layer.add_child(fish)
		fishes.append(fish)
	for data: Dictionary in snap.shots:
		shots.shots.append(data.duplicate(true))
	last_bonus_state = str(director.timers.bonus_state)

func _physics_process(delta: float) -> void:
	if state != State.PLAYING or portrait:
		return
	clock += delta
	save_elapsed += delta
	notice_cooldown = maxf(0, notice_cooldown - delta)
	var reduced: bool = bool(economy.data.settings.reduce_flash)
	seabed.simulate(delta, reduced)
	cannon.simulate(delta, 0.0 if hud.basket_open else inputs.turn_axis())
	if not hud.basket_open and inputs.fire:
		_fire()
	for fish: FishActor in fishes:
		fish.simulate(delta, reduced)
	fishes = fishes.filter(_keep_fish)
	shots.simulate(delta, fishes, _resolve_net)
	director.simulate(delta, hud.basket_open, fishes, catalog, rng, _spawn)
	if last_bonus_state != director.timers.bonus_state:
		dirty = true
		if director.timers.bonus_state == "warning":
			pending_feedback.append(func() -> void: effects.sound("warning"))
		last_bonus_state = str(director.timers.bonus_state)
	if dirty or save_elapsed >= 2:
		if not _flush():
			return
	effects.simulate(delta)

func _process(delta: float) -> void:
	if hud == null:
		return
	hud.animate(delta)
	hud.update_warning(str(director.timers.bonus_state), float(director.timers.warning))

func _keep_fish(fish: FishActor) -> bool:
	if fish.state == FishActor.State.REMOVED:
		fish.queue_free()
		return false
	return fish.state not in [FishActor.State.CAPTURED, FishActor.State.REWARDING]

func _spawn(definition: FishDefinition, count: int, formation: int) -> void:
	var group: int = _id()
	var direction: int = 1 if rng.randf() < 0.5 else -1
	var base_y: float = rng.randf_range(245, 520)
	var phase: float = rng.randf_range(0, TAU)
	var speed: float = rng.randf_range(definition.speed_range.x, definition.speed_range.y)
	var amplitude: float = rng.randf_range(18, 48)
	if definition.spawn_kind == "bonus":
		base_y = 405
		amplitude = 65
	for index: int in range(count):
		var offset: Vector2 = Vector2.ZERO
		match formation:
			0: offset = Vector2(-index * 38, sin(index * 0.7) * 24)
			1: offset = Vector2(-index * 46, sin(index * 0.45) * 62)
			2: offset = Vector2(-index * 33, (index % 2) * 43 - 22)
			3: offset = Vector2(-index * 32 + rng.randf_range(-12, 12), rng.randf_range(-65, 65))
		var start: Vector2 = Vector2(-definition.length * 0.5 - 30 if direction == 1 else 1630 + definition.length * 0.5, base_y)
		start += Vector2(offset.x * direction, offset.y)
		var data: Dictionary = {"id": _id(), "school": group, "position": [start.x, start.y], "origin": [start.x, start.y],
			"direction": direction, "speed": speed * (1 + index * 0.002), "age": 0.0,
			"phase": phase + index * 0.08, "amplitude": amplitude, "life": 65.0}
		var fish: FishActor = FishActor.new()
		fish.setup(definition, data)
		fish_layer.add_child(fish)
		fishes.append(fish)
	if definition.spawn_kind == "shark":
		pending_feedback.append(func() -> void: hud.toast("深海巨鲨，正从远海游来…"))
	dirty = true

func _id() -> int:
	var result: int = next_id
	next_id += 1
	return result

func _fire() -> void:
	if state != State.PLAYING or hud.basket_open or portrait or cannon.cooldown > 0 or shots.shots.size() >= 24:
		return
	var net: NetDefinition = catalog.net_by_id(str(economy.data.selected_net_id))
	if not economy.spend(net):
		if notice_cooldown <= 0:
			hud.toast("补给箱已备好，随时免费领取金币和弹药。")
			notice_cooldown = 2.5
		return
	shots.launch(_id(), cannon.muzzle(), cannon.direction_vector(), net.freeze())
	cannon.fired()
	effects.sound("fire")
	dirty = true

func _resolve_net(center: Vector2, net: Dictionary) -> void:
	var caught: Array[FishActor] = []
	var hit: Array[FishActor] = []
	for fish: FishActor in fishes:
		if not resolver.covered(fish, center, float(net.radius)):
			continue
		if resolver.succeeds(fish, net, rng):
			if fish.definition.reward_mode == "bonus_direct":
				fish.state = FishActor.State.REWARDING
				economy.bonus()
				director.start_reward()
			else:
				fish.state = FishActor.State.CAPTURED
				economy.capture(fish.definition, fish.instance_id)
			caught.append(fish)
		else:
			hit.append(fish)
	pending_feedback.append(func() -> void:
		effects.open_net(center, net)
		for fish: FishActor in hit:
			if is_instance_valid(fish):
				fish.hit()
		for fish: FishActor in caught:
			effects.capture_fish(fish, net, fish.definition.reward_mode == "bonus_direct")
			if fish.definition.reward_mode == "bonus_direct":
				hud.wallet_seconds = director.event.reward_seconds
	)
	dirty = true

func _snapshot() -> Dictionary:
	var fish_data: Array[Dictionary] = []
	for fish: FishActor in fishes:
		if fish.state not in [FishActor.State.CAPTURED, FishActor.State.REWARDING, FishActor.State.REMOVED]:
			fish_data.append(fish.snapshot())
	return {"next_id": next_id, "clock": clock, "rng_state": str(rng.state),
		"cannon_angle": cannon.angle, "cooldown": cannon.cooldown,
		"fish": fish_data, "shots": shots.shots.duplicate(true), "director": director.timers.duplicate(true)}

func _flush() -> bool:
	if economy.data.is_empty():
		return false
	economy.data.session_snapshot = _snapshot()
	if not saves.write_save(economy.data):
		state = State.SAVING_ERROR
		inputs.clear()
		hud.show_menu("saving_error", saves.last_error)
		return false
	dirty = false
	save_elapsed = 0
	for feedback: Callable in pending_feedback:
		feedback.call()
	pending_feedback.clear()
	hud.refresh(economy.data, economy.inventory_count())
	return true

func _input(event: InputEvent) -> void:
	inputs.track(event)

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey:
		if event.keycode == KEY_ESCAPE and event.pressed and not event.echo:
			if state == State.PLAYING:
				if hud.basket_open:
					_toggle_basket()
				else:
					_menu("pause")
			elif state == State.PAUSED:
				_menu("resume")
			get_viewport().set_input_as_handled()
			return
		if state == State.PLAYING and not hud.basket_open:
			inputs.accept_key(event)
	if event is InputEventScreenTouch and event.pressed and inputs.mobile and event.index == inputs.primary_touch:
		if state == State.PLAYING and not hud.basket_open and not portrait and cannon.cooldown <= 0 and ShotSystem.WATER.has_point(event.position) and mobile_safe_rect.has_point(event.position) and event.position.y < 730:
			cannon.aim(event.position)
			_fire()
		get_viewport().set_input_as_handled()

func _select_net(id: String) -> void:
	if state != State.PLAYING:
		return
	economy.data.selected_net_id = id
	dirty = true
	pending_feedback.append(func() -> void: effects.sound("ui"))
	_flush()

func _toggle_basket() -> void:
	if state != State.PLAYING:
		return
	inputs.clear()
	hud.toggle_basket()
	effects.sound("ui")

func _sell(id: String) -> void:
	if state != State.PLAYING or not hud.basket_open:
		return
	var income: int = economy.sell(id)
	if income > 0:
		dirty = true
		pending_feedback.append(func() -> void: effects.sold(income))
		_flush()

func _setting(key: String, value: Variant) -> void:
	if state != State.PAUSED:
		return
	economy.data.settings[key] = value
	_apply_settings()
	dirty = true
	_flush()

func _apply_settings() -> void:
	effects.sound_enabled = bool(economy.data.settings.sound)
	effects.reduce_flash = bool(economy.data.settings.reduce_flash)
	effects.low_quality = economy.data.settings.quality == "low"
	seabed.low_quality = effects.low_quality
	cannon.reduce_flash = effects.reduce_flash
	AudioServer.set_bus_volume_db(0, linear_to_db(maxf(0.0001, float(economy.data.settings.volume))))

func _menu(action: String) -> void:
	inputs.clear()
	match action:
		"pause", "supply":
			if state != State.PLAYING:
				return
			state = State.PAUSED
			_pause_audio(true)
			if _flush():
				hud.show_menu(action)
		"resume":
			if state != State.PAUSED:
				return
			hud.close_menu()
			state = State.PLAYING
			_pause_audio(false)
		"sound":
			if state != State.PLAYING:
				return
			economy.data.settings.sound = not bool(economy.data.settings.sound)
			_apply_settings()
			dirty = true
			_flush()
		"claim_supply":
			if state != State.PAUSED or hud.current_state != "supply":
				return
			economy.supply()
			dirty = true
			pending_feedback.append(func() -> void:
				hud.toast("补给已送达  +1,000 弹药  +5,000 金币")
				effects.sound("supply")
			)
			if _flush():
				_menu("resume")
		"retry_save":
			if state == State.SAVING_ERROR and _flush():
				state = State.PAUSED
				hud.show_menu("pause")
		"retry_load":
			if state == State.LOAD_ERROR:
				_load_game()
		"confirm_new":
			if state == State.LOAD_ERROR:
				hud.show_menu("confirm_new")
		"new_game":
			if state == State.LOAD_ERROR and hud.current_state == "confirm_new":
				if saves.preserve_before_reset():
					_new_game()
				else:
					hud.show_menu("load_error", saves.last_error)
		"quit":
			if state == State.PAUSED and _flush():
				quitting = true
				get_tree().quit()

func _pause_audio(paused: bool) -> void:
	for player: AudioStreamPlayer in effects.players:
		player.stream_paused = paused

func _notification(what: int) -> void:
	if hud == null or quitting:
		return
	if what in [NOTIFICATION_APPLICATION_FOCUS_OUT, NOTIFICATION_APPLICATION_PAUSED]:
		if state == State.PLAYING:
			_menu("pause")
	elif what == NOTIFICATION_WM_CLOSE_REQUEST:
		if state == State.LOAD_ERROR:
			get_tree().quit()
		elif state != State.SAVING_ERROR and _flush():
			quitting = true
			get_tree().quit()
	elif what == NOTIFICATION_WM_GO_BACK_REQUEST:
		if state == State.PLAYING:
			if hud.basket_open:
				_toggle_basket()
			else:
				_menu("pause")
		elif state == State.PAUSED:
			_menu("resume")

func _check_orientation() -> void:
	if not inputs.mobile:
		return
	var size: Vector2i = DisplayServer.window_get_size()
	portrait = size.y > size.x
	hud.orientation_layer.visible = portrait
	if portrait and state == State.PLAYING:
		_menu("pause")
	var safe: Rect2i = DisplayServer.get_display_safe_area()
	if safe.size.x <= 0 or safe.size.y <= 0:
		return
	var inverse: Transform2D = get_viewport().get_screen_transform().affine_inverse()
	var upper: Vector2 = inverse * Vector2(safe.position)
	var lower: Vector2 = inverse * Vector2(safe.end)
	upper = upper.clamp(Vector2.ZERO, Vector2(1600, 900))
	lower = lower.clamp(Vector2.ZERO, Vector2(1600, 900))
	mobile_safe_rect = Rect2(upper, lower - upper)
	var factor: float = minf(mobile_safe_rect.size.x / 1600, mobile_safe_rect.size.y / 900)
	hud.scale = Vector2.ONE * factor
	hud.position = upper + (mobile_safe_rect.size - Vector2(1600, 900) * factor) * 0.5
	effects.wallet_target = hud.position + Vector2(1248, 50) * factor
	effects.basket_target = hud.position + Vector2(1430, 692) * factor
