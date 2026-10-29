shader_type canvas_item;
uniform float water_time = 0.0;
uniform float strength = 0.035;
void fragment() {
	vec2 p = UV * vec2(18.0, 11.0);
	float a = sin(p.x * 1.8 + sin(p.y * 2.1 + water_time * 0.25));
	float b = cos(p.y * 1.7 + cos(p.x * 1.3 - water_time * 0.2));
	float caustic = pow(1.0 - abs(a * b), 15.0);
	COLOR = vec4(0.35, 0.92, 0.88, caustic * strength);
}
