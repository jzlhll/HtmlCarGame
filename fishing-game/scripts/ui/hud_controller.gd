class_name HudController
extends Control

signal net_selected(id: String)
signal basket_toggled
signal sell_requested(fish_id: String)
signal supply_requested
signal menu_requested(action: String)
signal setting_changed(key: String, value: Variant)

var catalog: GameCatalog
var mobile: bool = false
var basket_open: bool = false
var wallet_label: Label
var ammo_label: Label
var current_net_label: Label
var basket_button: Button
var sound_button: Button
var net_buttons: Dictionary[String, Button] = {}
var basket_layer: Control
var basket_rows: VBoxContainer
var sell_all: Button
var menu_layer: Control
var menu_title: Label
var menu_message: Label
var menu_buttons: HBoxContainer
var settings_box: VBoxContainer
var warning_label: Label
var toast_label: Label
var orientation_layer: Control
var volume_slider: HSlider
var sound_check: CheckButton
var flash_check: CheckButton
var quality_check: CheckButton
var shown_wallet: float = 50000
var target_wallet: int = 50000
var toast_time: float = 0
var wallet_initialized: bool = false
var current_state: String = ""
var wallet_seconds: float = 0
var wallet_bag: TextureRect
var wallet_pulse: float = 0

func _ready() -> void:
	size = Vector2(1600, 900)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	var ui_theme: Theme = Theme.new()
	ui_theme.default_font = preload("res://resources/ui_font.tres")
	ui_theme.default_font_size = 22
	ui_theme.set_color("font_color", "Label", Color("e6eee7"))
	for state: String in ["normal", "hover", "pressed", "disabled"]:
		var style: StyleBoxFlat = _style(Color("103d48") if state == "normal" else Color("205b62"), Color("527474"), 14)
		if state == "disabled":
			style.bg_color = Color("18333b")
		ui_theme.set_stylebox(state, "Button", style)
	ui_theme.set_color("font_color", "Button", Color("e7dfc5"))
	ui_theme.set_color("font_hover_color", "Button", Color("fff0c8"))
	ui_theme.set_color("font_disabled_color", "Button", Color("668184"))
	theme = ui_theme
	_build_hud()
	_build_basket()
	_build_menu()
	warning_label = _label(self, "", Rect2(470, 107, 660, 56), 25, Color("ffe3a1"))
	warning_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	warning_label.add_theme_stylebox_override("normal", _style(Color(0.035, 0.13, 0.18, 0.92), Color("d0af6e"), 18))
	warning_label.z_index = 20
	warning_label.hide()
	toast_label = _label(self, "", Rect2(405, 653, 790, 46), 23, Color("f0e5c5"))
	toast_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	toast_label.z_index = 25
	orientation_layer = Control.new()
	orientation_layer.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(orientation_layer)
	orientation_layer.z_index = 50
	var cover: ColorRect = ColorRect.new()
	cover.color = Color("072a38")
	cover.size = Vector2(1600, 900)
	orientation_layer.add_child(cover)
	var rotate: Label = _label(orientation_layer, "请横屏游玩\n转动设备后继续", Rect2(300, 320, 1000, 240), 42)
	rotate.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	orientation_layer.hide()

func _style(background: Color, border: Color, radius: int = 16) -> StyleBoxFlat:
	var style: StyleBoxFlat = StyleBoxFlat.new()
	style.bg_color = background
	style.border_color = border
	style.set_border_width_all(1)
	style.set_corner_radius_all(radius)
	style.content_margin_left = 16
	style.content_margin_right = 16
	style.content_margin_top = 10
	style.content_margin_bottom = 10
	return style

func _label(parent: Node, value: String, rect: Rect2, font_size: int = 22, color: Color = Color("e6eee7")) -> Label:
	var label: Label = Label.new()
	label.text = value
	label.position = rect.position
	label.size = rect.size
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", color)
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(label)
	return label

func _button(parent: Node, value: String, rect: Rect2, action: Callable) -> Button:
	var button: Button = Button.new()
	button.text = value
	button.position = rect.position
	button.size = rect.size
	button.focus_mode = Control.FOCUS_NONE
	button.pressed.connect(action)
	parent.add_child(button)
	return button

func _build_hud() -> void:
	_label(self, "潮汐渔场", Rect2(42, 20, 235, 52), 34, Color("f2e2b6"))
	_label(self, "T I D A L  ·  珊瑚秘境", Rect2(285, 26, 290, 42), 17, Color("9fbec0"))
	_button(self, "暂停", Rect2(930, 25, 100, 50), func() -> void: menu_requested.emit("pause"))
	sound_button = _button(self, "声音 开", Rect2(1045, 25, 125, 50), func() -> void: menu_requested.emit("sound"))
	wallet_bag = TextureRect.new()
	wallet_bag.texture = preload("res://assets/art/coin_bag.svg")
	wallet_bag.position = Vector2(1218, 22)
	wallet_bag.size = Vector2(60, 60)
	wallet_bag.pivot_offset = Vector2(30, 45)
	wallet_bag.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	wallet_bag.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(wallet_bag)
	wallet_label = _label(self, "50,000", Rect2(1290, 21, 265, 57), 32, Color("f5d895"))
	wallet_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_label(self, "轻触海面，从炮口发射" if mobile else "←  →  转动炮台     SHIFT  开炮", Rect2(460, 103, 680, 35), 18, Color("bad5d1")).horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_button(self, "＋ 免费补给", Rect2(44, 664, 205, 56), func() -> void: menu_requested.emit("supply"))
	basket_button = _button(self, "鱼篓  0 尾", Rect2(1330, 664, 225, 56), func() -> void: basket_toggled.emit())
	basket_button.icon = preload("res://assets/art/basket.svg")
	basket_button.expand_icon = true
	basket_button.add_theme_constant_override("icon_max_width", 34)
	for index: int in range(catalog.nets.size()):
		var net: NetDefinition = catalog.nets[index]
		var rect: Rect2
		if mobile:
			rect = Rect2(38 + (index % 3) * 194, 741 + (index / 3) * 72, 182, 64)
		else:
			rect = Rect2(40 + index * 190 if index < 3 else 1002 + (index - 3) * 190, 790, 178, 88)
		var rank: String = ["Ⅰ", "Ⅱ", "Ⅲ", "Ⅳ", "Ⅴ", "Ⅵ"][net.tier - 1]
		var button: Button = _button(self, "%s %s\n◈ %d / 发" % [rank, net.display_name, net.coin_cost], rect, func() -> void: net_selected.emit(net.id))
		button.icon = net.icon
		button.expand_icon = true
		button.add_theme_constant_override("icon_max_width", 37)
		button.add_theme_font_size_override("font_size", 21 if not mobile else 20)
		button.add_theme_color_override("icon_normal_color", net.effect_theme)
		net_buttons[net.id] = button
	current_net_label = _label(self, "破网", Rect2(675, 860, 250, 34), 21, Color("e9d7a8"))
	current_net_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	ammo_label = _label(self, "弹药 10,000", Rect2(935, 736, 286, 33), 20, Color("d4e8e3"))
	ammo_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER

func _modal() -> Control:
	var layer: Control = Control.new()
	layer.size = Vector2(1600, 900)
	layer.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(layer)
	var backdrop: ColorRect = ColorRect.new()
	backdrop.color = Color(0.005, 0.025, 0.04, 0.57)
	backdrop.size = Vector2(1600, 900)
	layer.add_child(backdrop)
	return layer

func _panel(parent: Node, rect: Rect2) -> Panel:
	var panel: Panel = Panel.new()
	panel.position = rect.position
	panel.size = rect.size
	panel.add_theme_stylebox_override("panel", _style(Color("0b303e"), Color("8b916e"), 24))
	parent.add_child(panel)
	return panel

func _build_basket() -> void:
	basket_layer = _modal()
	var panel: Panel = _panel(basket_layer, Rect2(845, 174, 710, 567))
	_label(panel, "今日渔获", Rect2(30, 21, 420, 48), 32, Color("f1dca9"))
	_label(panel, "海面仍在流动 · 出售后金币入袋", Rect2(32, 76, 580, 35), 19, Color("9ebdbf"))
	_button(panel, "关闭", Rect2(575, 25, 105, 49), func() -> void: basket_toggled.emit())
	var scroll: ScrollContainer = ScrollContainer.new()
	scroll.position = Vector2(28, 126)
	scroll.size = Vector2(654, 342)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	panel.add_child(scroll)
	basket_rows = VBoxContainer.new()
	basket_rows.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	basket_rows.add_theme_constant_override("separation", 10)
	scroll.add_child(basket_rows)
	sell_all = _button(panel, "全部出售", Rect2(28, 485, 654, 57), func() -> void: sell_requested.emit(""))
	basket_layer.hide()

func refresh(data: Dictionary, count: int) -> void:
	target_wallet = int(data.wallet.coins)
	if not wallet_initialized:
		shown_wallet = target_wallet
		wallet_initialized = true
	ammo_label.text = "弹药  %s" % _format(int(data.wallet.ammo))
	basket_button.text = "鱼篓  %d 尾" % count
	sound_button.text = "声音 开" if data.settings.sound else "声音 关"
	for net: NetDefinition in catalog.nets:
		var selected: bool = net.id == data.selected_net_id
		net_buttons[net.id].add_theme_stylebox_override("normal", _style(Color("244e54") if selected else Color("0c303d"), Color("e3c27e") if selected else Color("42676b"), 14))
		if selected:
			current_net_label.text = net.display_name
	for row: Node in basket_rows.get_children():
		basket_rows.remove_child(row)
		row.queue_free()
	var total: int = 0
	var grouped: Dictionary = {}
	for entry: Dictionary in data.inventory:
		var id: String = entry.fish_id
		if not grouped.has(id):
			grouped[id] = {"quantity": 0, "income": 0, "prices": []}
		grouped[id].quantity += int(entry.quantity)
		grouped[id].income += int(entry.unit_value) * int(entry.quantity)
		if int(entry.unit_value) not in grouped[id].prices:
			grouped[id].prices.append(int(entry.unit_value))
	for id: String in grouped:
		var info: Dictionary = grouped[id]
		var row: HBoxContainer = HBoxContainer.new()
		row.custom_minimum_size = Vector2(640, 88)
		row.add_theme_constant_override("separation", 14)
		basket_rows.add_child(row)
		var image: TextureRect = TextureRect.new()
		image.texture = catalog.fish[id].texture
		image.custom_minimum_size = Vector2(98, 78)
		image.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		image.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		row.add_child(image)
		var label: Label = Label.new()
		var prices: String = str(info.prices[0]) if info.prices.size() == 1 else "按捕获批次"
		label.text = "%s × %d\n单价 %s 金币" % [catalog.fish[id].display_name, info.quantity, prices]
		label.add_theme_font_size_override("font_size", 20)
		label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(label)
		var button: Button = Button.new()
		button.text = "出售  +%s" % _format(int(info.income))
		button.focus_mode = Control.FOCUS_NONE
		button.custom_minimum_size = Vector2(190, 68)
		button.pressed.connect(func() -> void: sell_requested.emit(id))
		row.add_child(button)
		total += int(info.income)
	if grouped.is_empty():
		var empty: Label = Label.new()
		empty.text = "鱼篓还空着\n试着用渔网收获第一条鱼吧"
		empty.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		empty.custom_minimum_size = Vector2(630, 240)
		empty.add_theme_color_override("font_color", Color("9ebdbf"))
		basket_rows.add_child(empty)
	sell_all.text = "全部出售  +%s 金币" % _format(total)
	sell_all.disabled = total <= 0
	sound_check.set_pressed_no_signal(bool(data.settings.sound))
	flash_check.set_pressed_no_signal(bool(data.settings.reduce_flash))
	quality_check.set_pressed_no_signal(data.settings.quality == "low")
	volume_slider.set_value_no_signal(float(data.settings.volume))

func _build_menu() -> void:
	menu_layer = _modal()
	menu_layer.z_index = 10
	var panel: Panel = _panel(menu_layer, Rect2(440, 172, 720, 580))
	menu_title = _label(panel, "潮汐暂歇", Rect2(36, 24, 648, 58), 36, Color("f1dca9"))
	menu_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	menu_message = _label(panel, "", Rect2(40, 92, 640, 95), 22, Color("adc8c8"))
	menu_message.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	menu_message.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	settings_box = VBoxContainer.new()
	settings_box.position = Vector2(70, 197)
	settings_box.size = Vector2(580, 240)
	settings_box.add_theme_constant_override("separation", 8)
	panel.add_child(settings_box)
	sound_check = CheckButton.new()
	sound_check.text = "音效"
	sound_check.focus_mode = Control.FOCUS_NONE
	sound_check.toggled.connect(func(value: bool) -> void: setting_changed.emit("sound", value))
	settings_box.add_child(sound_check)
	flash_check = CheckButton.new()
	flash_check.text = "减少闪光"
	flash_check.focus_mode = Control.FOCUS_NONE
	flash_check.toggled.connect(func(value: bool) -> void: setting_changed.emit("reduce_flash", value))
	settings_box.add_child(flash_check)
	quality_check = CheckButton.new()
	quality_check.text = "低画质 · 减少环境粒子"
	quality_check.focus_mode = Control.FOCUS_NONE
	quality_check.toggled.connect(func(value: bool) -> void: setting_changed.emit("quality", "low" if value else "high"))
	settings_box.add_child(quality_check)
	var volume_text: Label = Label.new()
	volume_text.text = "主音量"
	settings_box.add_child(volume_text)
	volume_slider = HSlider.new()
	volume_slider.min_value = 0
	volume_slider.max_value = 1
	volume_slider.step = 0.05
	volume_slider.custom_minimum_size.y = 36
	volume_slider.focus_mode = Control.FOCUS_NONE
	volume_slider.value_changed.connect(func(value: float) -> void: setting_changed.emit("volume", value))
	settings_box.add_child(volume_slider)
	menu_buttons = HBoxContainer.new()
	menu_buttons.position = Vector2(40, 480)
	menu_buttons.size = Vector2(640, 65)
	menu_buttons.alignment = BoxContainer.ALIGNMENT_CENTER
	menu_buttons.add_theme_constant_override("separation", 18)
	panel.add_child(menu_buttons)
	menu_layer.hide()

func show_menu(kind: String, message: String = "") -> void:
	current_state = kind
	menu_layer.show()
	settings_box.visible = kind == "pause"
	menu_message.text = message
	for child: Node in menu_buttons.get_children():
		menu_buttons.remove_child(child)
		child.queue_free()
	var actions: Array[Array] = []
	match kind:
		"pause":
			menu_title.text = "潮汐暂歇"
			menu_message.text = "海流为你停留，准备好了再出发。"
			actions = [["继续游玩", "resume"], ["保存并退出", "quit"]]
		"supply":
			menu_title.text = "海港补给"
			menu_message.text = "领取 1,000 发弹药与 5,000 金币\n免费，不限次数。"
			actions = [["领取补给", "claim_supply"], ["返回海面", "resume"]]
		"saving_error":
			menu_title.text = "进度尚未保存"
			actions = [["重试保存", "retry_save"]]
		"load_error":
			menu_title.text = "需要恢复存档"
			actions = [["重新读取", "retry_load"], ["新建存档…", "confirm_new"]]
		"confirm_new":
			menu_title.text = "确认新建存档"
			menu_message.text = "当前文件将保留为归档，新的渔场从初始资源开始。"
			actions = [["确认新建", "new_game"], ["返回", "retry_load"]]
	for action: Array in actions:
		var button: Button = Button.new()
		button.text = action[0]
		button.custom_minimum_size = Vector2(245, 60)
		button.focus_mode = Control.FOCUS_NONE
		button.pressed.connect(func() -> void: menu_requested.emit(action[1]))
		menu_buttons.add_child(button)

func close_menu() -> void:
	menu_layer.hide()
	current_state = ""

func toggle_basket() -> void:
	basket_open = not basket_open
	basket_layer.visible = basket_open

func toast(message: String) -> void:
	toast_label.text = message
	toast_time = 2.5

func update_warning(state: String, remaining: float) -> void:
	warning_label.visible = state == "warning" or state == "active"
	warning_label.text = "星翼宝鲂即将经过  ·  %d" % ceili(remaining) if state == "warning" else "星翼宝鲂  ·  星光掠过海面"

func animate(delta: float) -> void:
	var speed: float = absf(target_wallet - shown_wallet) / maxf(delta, wallet_seconds) if wallet_seconds > 0 else maxf(20, absf(target_wallet - shown_wallet) * 7)
	shown_wallet = move_toward(shown_wallet, target_wallet, speed * delta)
	wallet_seconds = maxf(0, wallet_seconds - delta)
	wallet_label.text = _format(roundi(shown_wallet))
	wallet_pulse = maxf(0, wallet_pulse - delta)
	wallet_bag.scale = Vector2.ONE * (1 + sin(wallet_pulse / 0.22 * PI) * 0.12)
	toast_time = maxf(0, toast_time - delta)
	toast_label.visible = toast_time > 0

func _format(value: int) -> String:
	var digits: String = str(value)
	var result: String = ""
	for index: int in range(digits.length()):
		if index > 0 and (digits.length() - index) % 3 == 0:
			result += ","
		result += digits[index]
	return result

func _draw() -> void:
	draw_rect(Rect2(0, 0, 1600, 95), Color(0.015, 0.07, 0.105, 0.88))
	draw_line(Vector2(40, 95), Vector2(1560, 95), Color(0.63, 0.73, 0.64, 0.35), 1)
	draw_rect(Rect2(0, 766, 660, 134), Color(0.015, 0.07, 0.10, 0.94))
	draw_rect(Rect2(940, 766, 660, 134), Color(0.015, 0.07, 0.10, 0.94))
	draw_line(Vector2(40, 766), Vector2(660, 766), Color(0.67, 0.70, 0.52, 0.5), 1)
	draw_line(Vector2(940, 766), Vector2(1560, 766), Color(0.67, 0.70, 0.52, 0.5), 1)
