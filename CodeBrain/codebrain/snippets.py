"""📦 Code snippets: ready-made pieces of game code you can drop into your own games.

Every built-in snippet is a tiny program you can ▶ Try. The useful part sits between
'# >>> SNIPPET' and '# <<< SNIPPET', and that's the part that gets inserted into your code.
You can save your own snippets too ("⭐ My snippets").
"""

import json
import time
import uuid
from pathlib import Path

from codebrain.paths import brain_dir

MOVES_2D = "🕹️ 2D moves"
MOVES_3D = "🧊 3D moves"
COMBAT = "⚔️ Combat"
GAME = "🎲 Game stuff"
MINE = "⭐ My snippets"
CATEGORIES = [MOVES_2D, MOVES_3D, COMBAT, GAME, MINE]

START, END = "# >>> SNIPPET", "# <<< SNIPPET"

BUILTIN = [
    # ------------------------------------------------------------------ 2D
    {
        "id": "move2d", "name": "Move with WASD", "category": MOVES_2D, "lib": "pygame",
        "description": "Smooth movement with WASD or arrows. Going diagonal isn't faster (that's what normalize() fixes).",
        "code": '''import pygame

# >>> SNIPPET: move with WASD (same speed in every direction)
def move_player(pos, speed, dt):
    """Moves pos (a pygame.Vector2) with WASD/arrow keys and returns the new position."""
    keys = pygame.key.get_pressed()
    direction = pygame.Vector2(
        (keys[pygame.K_d] or keys[pygame.K_RIGHT]) - (keys[pygame.K_a] or keys[pygame.K_LEFT]),
        (keys[pygame.K_s] or keys[pygame.K_DOWN]) - (keys[pygame.K_w] or keys[pygame.K_UP]),
    )
    if direction.length() > 0:
        direction = direction.normalize()      # length 1, so diagonal isn't faster
    return pos + direction * speed * dt
# <<< SNIPPET

pygame.init()
screen = pygame.display.set_mode((800, 600))
pygame.display.set_caption("WASD to move")
clock = pygame.time.Clock()
pos = pygame.Vector2(400, 300)

running = True
while running:
    dt = clock.tick(60) / 1000
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
    pos = move_player(pos, 300, dt)
    screen.fill((20, 20, 30))
    pygame.draw.circle(screen, (57, 255, 136), pos, 20)
    pygame.display.flip()
pygame.quit()
''',
    },
    {
        "id": "jump2d", "name": "Jump + gravity", "category": MOVES_2D, "lib": "pygame",
        "description": "A player that falls with gravity, lands on platforms and jumps with SPACE.",
        "code": '''import pygame

# >>> SNIPPET: jump + gravity + landing on platforms
GRAVITY = 1800       # pixels per second, per second (how fast you fall)
JUMP_SPEED = 750     # how strong the jump is


class Jumper:
    def __init__(self, x, y):
        self.rect = pygame.Rect(x, y, 40, 50)
        self.y = float(y)        # exact position (rect only holds whole numbers)
        self.vel_y = 0.0
        self.on_ground = False

    def jump(self):
        if self.on_ground:
            self.vel_y = -JUMP_SPEED      # negative = up in pygame
            self.on_ground = False

    def update(self, dt, platforms):
        old_bottom = self.rect.bottom
        self.vel_y += GRAVITY * dt
        self.y += self.vel_y * dt
        self.rect.y = round(self.y)
        self.on_ground = False
        for p in platforms:
            # only land when falling DOWN onto the top of a platform
            if self.rect.colliderect(p) and self.vel_y >= 0 and old_bottom <= p.top + 1:
                self.rect.bottom = p.top
                self.y = self.rect.y
                self.vel_y = 0
                self.on_ground = True
# <<< SNIPPET

pygame.init()
screen = pygame.display.set_mode((800, 600))
pygame.display.set_caption("A/D to move, SPACE to jump")
clock = pygame.time.Clock()
player = Jumper(100, 300)
platforms = [pygame.Rect(0, 560, 800, 40), pygame.Rect(250, 440, 180, 20),
             pygame.Rect(500, 330, 180, 20), pygame.Rect(150, 230, 160, 20)]

running = True
while running:
    dt = clock.tick(60) / 1000
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
        if event.type == pygame.KEYDOWN and event.key == pygame.K_SPACE:
            player.jump()
    keys = pygame.key.get_pressed()
    player.rect.x += (keys[pygame.K_d] - keys[pygame.K_a]) * 300 * dt
    player.update(dt, platforms)

    screen.fill((20, 20, 35))
    for p in platforms:
        pygame.draw.rect(screen, (90, 90, 110), p)
    pygame.draw.rect(screen, (57, 255, 136), player.rect)
    pygame.display.flip()
pygame.quit()
''',
    },
    {
        "id": "dash2d", "name": "Dash", "category": MOVES_2D, "lib": "pygame",
        "description": "A quick burst of speed with a cooldown so you can't spam it.",
        "code": '''import pygame

# >>> SNIPPET: dash with a cooldown
class Dash:
    def __init__(self, speed=1400, duration=0.15, cooldown=0.8):
        self.speed = speed
        self.duration = duration
        self.cooldown = cooldown
        self.time_left = 0.0
        self.cooldown_left = 0.0
        self.direction = pygame.Vector2()

    @property
    def ready(self):
        return self.cooldown_left <= 0

    def start(self, direction):
        if self.ready and direction.length() > 0:
            self.direction = direction.normalize()
            self.time_left = self.duration
            self.cooldown_left = self.cooldown

    def update(self, dt):
        """Returns how far the dash moves you this frame."""
        self.cooldown_left = max(0.0, self.cooldown_left - dt)
        if self.time_left > 0:
            self.time_left -= dt
            return self.direction * self.speed * dt
        return pygame.Vector2()
# <<< SNIPPET

pygame.init()
screen = pygame.display.set_mode((800, 600))
pygame.display.set_caption("WASD to move, SPACE to dash")
clock = pygame.time.Clock()
pos = pygame.Vector2(400, 300)
dash = Dash()

running = True
while running:
    dt = clock.tick(60) / 1000
    keys = pygame.key.get_pressed()
    move = pygame.Vector2(keys[pygame.K_d] - keys[pygame.K_a], keys[pygame.K_s] - keys[pygame.K_w])
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
        if event.type == pygame.KEYDOWN and event.key == pygame.K_SPACE:
            dash.start(move)
    if move.length() > 0:
        pos += move.normalize() * 250 * dt
    pos += dash.update(dt)
    pos.x = max(20, min(780, pos.x))
    pos.y = max(20, min(580, pos.y))

    screen.fill((20, 20, 30))
    color = (57, 255, 136) if dash.ready else (40, 120, 80)
    pygame.draw.circle(screen, color, pos, 20)
    bar = 1 - dash.cooldown_left / dash.cooldown
    pygame.draw.rect(screen, (57, 255, 136), (20, 20, 200 * bar, 10))
    pygame.display.flip()
pygame.quit()
''',
    },
    # ------------------------------------------------------------------ 3D
    {
        "id": "sprint3d", "name": "Sprint + crouch", "category": MOVES_3D, "lib": "ursina",
        "description": "Hold SHIFT to sprint (the view widens), hold CTRL to crouch (camera goes down, you go slower).",
        "code": '''from ursina import *
from ursina.prefabs.first_person_controller import FirstPersonController

app = Ursina()
ground = Entity(model='plane', scale=50, texture='grass', texture_scale=(10, 10), collider='box')
for i in range(8):
    Entity(model='cube', texture='brick', collider='box', position=(i * 3 - 12, 1, 8), scale=2)
player = FirstPersonController()
Sky()

# >>> SNIPPET: sprint (Shift) + crouch (Ctrl)
WALK_SPEED = 5
SPRINT_SPEED = 10
CROUCH_SPEED = 2.5
STAND_HEIGHT = 2
CROUCH_HEIGHT = 1


def update_movement():
    crouching = held_keys['control']
    sprinting = held_keys['shift'] and not crouching
    player.speed = CROUCH_SPEED if crouching else SPRINT_SPEED if sprinting else WALK_SPEED
    eye_height = CROUCH_HEIGHT if crouching else STAND_HEIGHT
    # lerp = slide smoothly toward the target instead of jumping there
    player.camera_pivot.y = lerp(player.camera_pivot.y, eye_height, 10 * time.dt)
    camera.fov = lerp(camera.fov, 100 if sprinting else 90, 8 * time.dt)
# <<< SNIPPET


def update():
    update_movement()


def input(key):
    if key == 'escape':
        application.quit()


app.run()
''',
    },
    {
        "id": "flashlight3d", "name": "Flashlight (F)", "category": MOVES_3D, "lib": "ursina",
        "description": "A spooky dark screen with a soft circle of light in the middle. Press F to switch it on/off. "
                       "It's a screen trick (works on every PC) + fog for darkness.",
        "code": '''from ursina import *
from ursina.prefabs.first_person_controller import FirstPersonController
from PIL import Image, ImageDraw, ImageFilter
import random

app = Ursina()
window.color = color.black
scene.fog_color = color.black
scene.fog_density = 0.06                 # things far away fade into the dark
ground = Entity(model='plane', scale=60, texture='grass', texture_scale=(12, 12), collider='box')
for i in range(25):
    Entity(model='cube', texture='brick', collider='box', scale=2,
           position=(random.uniform(-20, 20), 1, random.uniform(-20, 20)))
player = FirstPersonController()

# >>> SNIPPET: flashlight on F (a dark screen with a see-through circle)
def darkness_texture(light_radius):
    """Black picture covering the screen. light_radius = size of the clear circle (0 = all dark)."""
    w, h = int(512 * window.aspect_ratio), 512
    img = Image.new('RGBA', (w, h), (0, 0, 0, 240))
    if light_radius:
        ImageDraw.Draw(img).ellipse((w / 2 - light_radius, h / 2 - light_radius,
                                     w / 2 + light_radius, h / 2 + light_radius), fill=(0, 0, 0, 0))
        img = img.filter(ImageFilter.GaussianBlur(35))      # soft edge, like a real flashlight
    return Texture(img)


DARK = darkness_texture(0)
LIGHT_ON = darkness_texture(150)
darkness = Entity(parent=camera.ui, model='quad', texture=DARK, scale=(window.aspect_ratio, 1), z=1)
flashlight_on = False


def toggle_flashlight():
    global flashlight_on
    flashlight_on = not flashlight_on
    darkness.texture = LIGHT_ON if flashlight_on else DARK
# <<< SNIPPET

Text("F = flashlight   ESC = quit", position=window.top_left + Vec2(0.03, -0.03))


def input(key):
    if key == 'f':
        toggle_flashlight()
    if key == 'escape':
        application.quit()


app.run()
''',
    },
    # ------------------------------------------------------------------ combat
    {
        "id": "shoot3d", "name": "Raycast shooting + laser beam", "category": COMBAT, "lib": "ursina",
        "description": "Shoots an invisible ray from your eyes and draws a quick laser beam. Things with .hp take damage.",
        "code": '''from ursina import *
from ursina.prefabs.first_person_controller import FirstPersonController
import random

app = Ursina()
ground = Entity(model='plane', scale=40, texture='grass', texture_scale=(10, 10), collider='box')
player = FirstPersonController()
Sky()
for i in range(8):
    target = Entity(model='cube', color=color.orange, collider='box',
                    position=(random.uniform(-10, 10), 1, random.uniform(6, 16)))
    target.hp = 3

# >>> SNIPPET: shoot with a raycast + show a laser beam
LASER_COLOR = color.lime


def shoot(damage=1):
    hit = raycast(camera.world_position, camera.forward, distance=100, ignore=(player,))
    end = hit.world_point if hit.hit else camera.world_position + camera.forward * 100
    start = camera.world_position + camera.right * 0.3 + camera.down * 0.25   # from the "gun"
    beam = Entity(model=Mesh(vertices=[start, end], mode='line', thickness=4), color=LASER_COLOR)
    destroy(beam, delay=0.06)
    if hit.hit and hasattr(hit.entity, 'hp'):
        hit.entity.hp -= damage
        hit.entity.blink(color.white)          # flash when hit
        if hit.entity.hp <= 0:
            destroy(hit.entity)
    return hit
# <<< SNIPPET


def input(key):
    if key == 'left mouse down':
        shoot()
    if key == 'escape':
        application.quit()


app.run()
''',
    },
    {
        "id": "healthbar3d", "name": "Health bar", "category": COMBAT, "lib": "ursina",
        "description": "An on-screen health bar with take_damage() and heal(). Press H to get hurt, J to heal.",
        "code": '''from ursina import *
from ursina.prefabs.health_bar import HealthBar

app = Ursina()
Entity(model='cube', color=color.azure, rotation=(30, 45, 0))

# >>> SNIPPET: health bar on screen
health_bar = HealthBar(max_value=100, value=100, position=window.top_left + Vec2(0.03, -0.03), scale=(0.5, 0.03), bar_color=color.lime)


def take_damage(amount):
    health_bar.value = max(0, health_bar.value - amount)
    if health_bar.value <= 0:
        print("💀 Game over!")


def heal(amount):
    health_bar.value = min(health_bar.max_value, health_bar.value + amount)
# <<< SNIPPET

Text("H = take damage   J = heal", position=window.top_left + Vec2(0.03, -0.08))


def input(key):
    if key == 'h':
        take_damage(15)
    if key == 'j':
        heal(10)
    if key == 'escape':
        application.quit()


app.run()
''',
    },
    {
        "id": "damagenum3d", "name": "Damage numbers", "category": COMBAT, "lib": "ursina",
        "description": "Numbers that pop out of what you hit and float away. Click the cubes!",
        "code": '''from ursina import *
import random

app = Ursina()
for x in range(-3, 4, 2):
    Entity(model='cube', color=color.green, collider='box', position=(x, 0, 0))
EditorCamera()

# >>> SNIPPET: damage numbers that pop up and float away
def damage_number(amount, position, text_color=color.yellow):
    t = Text(str(amount), parent=scene, position=position + Vec3(0, 0.6, 0), billboard=True,
             scale=25, origin=(0, 0), color=text_color)
    float_to = t.position + Vec3(random.uniform(-0.5, 0.5), 1.5, 0)
    t.animate_position(float_to, duration=0.8, curve=curve.out_expo)
    t.fade_out(duration=0.8)
    destroy(t, delay=0.8)
# <<< SNIPPET


def input(key):
    if key == 'left mouse down' and mouse.hovered_entity:
        damage_number(random.randint(5, 30), mouse.world_point)
    if key == 'escape':
        application.quit()


app.run()
''',
    },
    # ------------------------------------------------------------------ game stuff
    {
        "id": "highscore", "name": "Save high score", "category": GAME, "lib": "python",
        "description": "Saves your best score in a file next to your game, so it's still there next time.",
        "code": '''import json
import random
from pathlib import Path

# >>> SNIPPET: save + load a high score
SAVE_FILE = Path(__file__).with_name("highscore.json")


def load_high_score():
    try:
        return json.loads(SAVE_FILE.read_text())["high_score"]
    except (OSError, ValueError, KeyError):
        return 0          # no save file yet


def save_high_score(score):
    """Saves only if it's a new record. Returns True if it was."""
    if score > load_high_score():
        SAVE_FILE.write_text(json.dumps({"high_score": score}))
        return True
    return False
# <<< SNIPPET

print("Best so far:", load_high_score())
score = random.randint(0, 100)
print("You scored:", score)
print("🏆 NEW RECORD!" if save_high_score(score) else "Not a record this time. Run again!")
''',
    },
    {
        "id": "timer", "name": "Countdown timer", "category": GAME, "lib": "pygame",
        "description": "A timer that counts down and shows 0:30 style text. R resets it.",
        "code": '''import pygame

# >>> SNIPPET: countdown timer
class Timer:
    def __init__(self, seconds):
        self.total = seconds
        self.left = float(seconds)

    def update(self, dt):
        self.left = max(0.0, self.left - dt)

    @property
    def done(self):
        return self.left <= 0

    def text(self):
        minutes, seconds = divmod(int(self.left + 0.999), 60)    # round up so it shows 0:01, not 0:00
        return f"{minutes}:{seconds:02d}"

    def reset(self):
        self.left = float(self.total)
# <<< SNIPPET

pygame.init()
screen = pygame.display.set_mode((600, 300))
pygame.display.set_caption("R to reset")
clock = pygame.time.Clock()
font = pygame.font.SysFont(None, 120)
timer = Timer(10)

running = True
while running:
    dt = clock.tick(60) / 1000
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
        if event.type == pygame.KEYDOWN and event.key == pygame.K_r:
            timer.reset()
    timer.update(dt)
    screen.fill((20, 20, 30))
    color = (255, 80, 80) if timer.done else (57, 255, 136)
    label = font.render("TIME UP!" if timer.done else timer.text(), True, color)
    screen.blit(label, label.get_rect(center=(300, 150)))
    pygame.display.flip()
pygame.quit()
''',
    },
    {
        "id": "pause", "name": "Pause menu (Esc)", "category": GAME, "lib": "pygame",
        "description": "ESC pauses the game and shows a menu. Up/Down to pick, Enter to choose.",
        "code": '''import pygame

# >>> SNIPPET: pause menu
def draw_pause_menu(screen, font, options, selected):
    overlay = pygame.Surface(screen.get_size(), pygame.SRCALPHA)
    overlay.fill((0, 0, 0, 160))                       # see-through black
    screen.blit(overlay, (0, 0))
    center_x = screen.get_width() // 2
    title = font.render("PAUSED", True, (57, 255, 136))
    screen.blit(title, title.get_rect(center=(center_x, 180)))
    for i, text in enumerate(options):
        color = (255, 255, 255) if i == selected else (120, 120, 120)
        label = font.render(("> " if i == selected else "") + text, True, color)
        screen.blit(label, label.get_rect(center=(center_x, 280 + i * 60)))
# <<< SNIPPET

pygame.init()
screen = pygame.display.set_mode((800, 600))
pygame.display.set_caption("ESC to pause")
clock = pygame.time.Clock()
font = pygame.font.SysFont(None, 60)
ball = pygame.Vector2(400, 300)
velocity = pygame.Vector2(300, 220)
paused = False
options = ["Resume", "Quit"]
selected = 0

running = True
while running:
    dt = clock.tick(60) / 1000
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
        elif event.type == pygame.KEYDOWN:
            if event.key == pygame.K_ESCAPE:
                paused = not paused
            elif paused and event.key in (pygame.K_UP, pygame.K_w):
                selected = (selected - 1) % len(options)
            elif paused and event.key in (pygame.K_DOWN, pygame.K_s):
                selected = (selected + 1) % len(options)
            elif paused and event.key == pygame.K_RETURN:
                if options[selected] == "Resume":
                    paused = False
                else:
                    running = False
    if not paused:                                     # the game only moves when NOT paused
        ball += velocity * dt
        if not 20 < ball.x < 780:
            velocity.x *= -1
        if not 20 < ball.y < 580:
            velocity.y *= -1
    screen.fill((20, 20, 30))
    pygame.draw.circle(screen, (57, 255, 136), ball, 20)
    if paused:
        draw_pause_menu(screen, font, options, selected)
    pygame.display.flip()
pygame.quit()
''',
    },
    {
        "id": "spawn", "name": "Random spawn (not too close)", "category": GAME, "lib": "pygame",
        "description": "Picks random spots to spawn enemies, but never right on top of the player.",
        "code": '''import random

import pygame

# >>> SNIPPET: spawn at a random spot, not too close to the player
def random_spawn(player_pos, min_distance, width, height, margin=20):
    best = None
    for _ in range(100):          # try 100 times, then use the farthest spot we found
        spot = pygame.Vector2(random.randint(margin, width - margin), random.randint(margin, height - margin))
        if spot.distance_to(player_pos) >= min_distance:
            return spot
        if best is None or spot.distance_to(player_pos) > best.distance_to(player_pos):
            best = spot
    return best
# <<< SNIPPET

pygame.init()
screen = pygame.display.set_mode((800, 600))
pygame.display.set_caption("Enemies never spawn inside the circle")
clock = pygame.time.Clock()
player = pygame.Vector2(400, 300)
enemies = []
timer = 0

running = True
while running:
    dt = clock.tick(60) / 1000
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
    player = pygame.Vector2(pygame.mouse.get_pos())
    timer += dt
    if timer > 0.3:
        timer = 0
        enemies.append(random_spawn(player, 150, 800, 600))
        enemies = enemies[-40:]
    screen.fill((20, 20, 30))
    pygame.draw.circle(screen, (40, 90, 60), player, 150, 2)
    pygame.draw.circle(screen, (57, 255, 136), player, 12)
    for e in enemies:
        pygame.draw.circle(screen, (255, 80, 80), e, 8)
    pygame.display.flip()
pygame.quit()
''',
    },
]


def snippet_part(code):
    """Just the useful part between the SNIPPET markers (or all of it if there are none)."""
    lines = code.splitlines()
    starts = [i for i, l in enumerate(lines) if l.strip().startswith(START)]
    ends = [i for i, l in enumerate(lines) if l.strip().startswith(END)]
    if not starts or not ends or ends[0] <= starts[0]:
        return code.strip("\n")
    return "\n".join(lines[starts[0]:ends[0] + 1]).strip("\n")


class Snippets:
    def __init__(self, path=None):
        self.path = Path(path) if path else brain_dir() / "snippets.json"
        self.mine = []
        if self.path.exists():
            try:
                self.mine = json.loads(self.path.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                self.mine = []

    def all(self):
        return BUILTIN + self.mine

    def in_category(self, category):
        return [s for s in self.all() if s["category"] == category]

    def get(self, snippet_id):
        for s in self.all():
            if s["id"] == snippet_id:
                return s
        return None

    def add(self, name, code, description=""):
        item = {"id": "my-" + uuid.uuid4().hex[:6], "name": name.strip(), "category": MINE, "lib": "",
                "description": description.strip() or f"Saved {time.strftime('%Y-%m-%d')}",
                "code": code.strip("\n") + "\n", "user": True}
        self.mine.append(item)
        self.save()
        return item

    def delete(self, snippet_id):
        before = len(self.mine)
        self.mine = [s for s in self.mine if s["id"] != snippet_id]
        self.save()
        return len(self.mine) < before

    def save(self):
        self.path.write_text(json.dumps(self.mine, indent=2, ensure_ascii=False), encoding="utf-8")
