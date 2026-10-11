"""📚 Lessons: Python basics -> 2D window -> how 3D works -> building your zombie game.

Every lesson has an explanation, example code you can load + run, a challenge, and a quiz.
The zombie track has NO game code on purpose: you build it yourself, CodeBrain coaches you.
"""

PY_TRACK = "🐍 Python Basics"
TRACK_2D = "🕹️ Making a 2D Window"
TRACK_3D = "🧊 How 3D Works"
TRACK_ZOMBIE = "🧟 Build Your Zombie Game"

TRACKS = [PY_TRACK, TRACK_2D, TRACK_3D, TRACK_ZOMBIE]

LESSONS = [
    # ------------------------------------------------------------------ PYTHON BASICS
    {
        "id": "py1", "track": PY_TRACK, "title": "1. print() and variables",
        "text": """Code is a list of instructions the computer does from TOP to BOTTOM.

• print("hi") shows text on the screen.
• A VARIABLE is like a labeled box that holds something:
      score = 0        <- box called score holds 0
      name = "Kai"     <- text goes in "quotes"
• You can change what's in the box:  score = score + 10

Press ▶️ Run and look at the Output panel.""",
        "code": '''# Lines starting with # are comments. Python ignores them - they're notes for humans.

player_name = "Hero"     # text (called a "string")
health = 100             # whole number (called an "int")
speed = 5.5              # decimal number (called a "float")

print("Welcome,", player_name)
print("Health:", health)

# A zombie bites you!
health = health - 25
print("Ouch! Health is now", health)

# f-strings let you put variables inside text with {curly brackets}
print(f"{player_name} runs at speed {speed}")
''',
        "challenge": "Add a variable called coins = 0, give yourself 50 coins, then print how many coins you have.",
        "quiz": {"q": "What does health = health - 25 do if health was 100?",
                 "options": ["Makes health 25", "Makes health 75", "Crashes", "Makes health -25"],
                 "answer": 1, "why": "It takes what's in the box (100), subtracts 25, and puts 75 back in."},
    },
    {
        "id": "py2", "track": PY_TRACK, "title": "2. input() and if / else",
        "text": """Programs make DECISIONS with if / elif / else.

    if health <= 0:
        print("Game over")      <- the 4 spaces (indent) mean "this belongs to the if"
    else:
        print("Keep going!")

• input("question") asks the user to type something. Type your answer in the
  box under the Output panel and press Enter.
• == means "is equal to?"   (one = puts something in a box, two == compares)
• int("5") turns text into a number.""",
        "code": '''name = input("What's your name? ")
age = int(input("How old are you? "))   # int() turns the typed text into a number

print(f"Hey {name}!")

if age >= 13:
    print("You can play Nightmare mode 😈")
elif age >= 8:
    print("Normal mode for you 🙂")
else:
    print("Easy mode - have fun!")

weapon = input("Pick a weapon (laser/sword): ")
if weapon == "laser":
    print("Pew pew! 🔫")
elif weapon == "sword":
    print("Swoosh! ⚔️")
else:
    print("That's not a weapon... you throw a shoe at the zombie 👟")
''',
        "challenge": "Ask 'How many zombies?' and print 'RUN!' if it's more than 10, otherwise 'Easy.'",
        "quiz": {"q": "Why are the lines under 'if' pushed in with spaces?",
                 "options": ["It looks nicer", "It tells Python they belong to the if", "Python needs exactly 2 spaces", "No reason"],
                 "answer": 1, "why": "Indentation is how Python knows which lines are 'inside' the if. Use 4 spaces."},
    },
    {
        "id": "py3", "track": PY_TRACK, "title": "3. Loops (doing things again and again)",
        "text": """Games are basically one BIG loop that runs 60 times a second!

• for loop - repeat a set number of times:
      for wave in range(1, 4):   -> wave is 1, then 2, then 3
• while loop - repeat WHILE something is true:
      while health > 0:
• break jumps out of a loop early.""",
        "code": '''import random   # lets us use random numbers

# FOR loop: 3 waves of zombies
for wave in range(1, 4):
    zombies = wave * 5
    print(f"🌊 Wave {wave}: {zombies} zombies incoming!")

print()

# WHILE loop: fight until someone loses
health = 100
zombie_health = 60
while health > 0 and zombie_health > 0:
    damage = random.randint(5, 20)
    zombie_health -= damage           # -= is a shortcut for zombie_health = zombie_health - damage
    print(f"You zap the zombie for {damage}! Zombie health: {max(zombie_health, 0)}")
    if zombie_health <= 0:
        break
    bite = random.randint(1, 15)
    health -= bite
    print(f"  Zombie bites you for {bite}. Your health: {health}")

print("🏆 You won!" if health > 0 else "💀 Game over")
''',
        "challenge": "Make a for loop that counts down from 10 to 1 and then prints 'LAUNCH! 🚀'. (Hint: range(10, 0, -1))",
        "quiz": {"q": "How many times does `for i in range(5):` run?",
                 "options": ["4", "5", "6", "Forever"], "answer": 1,
                 "why": "range(5) gives 0, 1, 2, 3, 4 - that's 5 numbers."},
    },
    {
        "id": "py4", "track": PY_TRACK, "title": "4. Functions (your own commands)",
        "text": """A FUNCTION is a mini-program with a name. You write it once, use it many times.

    def heal(health, amount):     <- def = "define a function"
        return health + amount    <- return = give back an answer

    health = heal(health, 20)     <- "call" the function

Games are made of functions: move_player(), shoot(), spawn_zombie()...""",
        "code": '''def make_zombie(kind):
    """Builds a zombie as a dictionary (a box with labeled slots)."""
    if kind == "runner":
        return {"kind": "runner", "health": 30, "speed": 8}
    elif kind == "boss":
        return {"kind": "boss", "health": 500, "speed": 2}
    return {"kind": "normal", "health": 50, "speed": 4}


def hit(zombie, damage):
    zombie["health"] -= damage
    if zombie["health"] <= 0:
        print(f"💥 The {zombie['kind']} zombie is defeated!")
    else:
        print(f"The {zombie['kind']} zombie has {zombie['health']} health left")


boss = make_zombie("boss")
runner = make_zombie("runner")

hit(runner, 20)
hit(runner, 20)
hit(boss, 100)
''',
        "challenge": "Write a function called laser_damage(level) that returns 10 * level, and print laser_damage(3).",
        "quiz": {"q": "What does `return` do?",
                 "options": ["Prints something", "Ends the program", "Gives an answer back to whoever called the function", "Repeats the function"],
                 "answer": 2, "why": "return sends a value back, like heal() giving back the new health."},
    },
    {
        "id": "py5", "track": PY_TRACK, "title": "5. Lists (lots of things in one box)",
        "text": """A LIST holds many things in order:  zombies = ["Bob", "Rob", "Gob"]

• zombies[0]          -> first item ("Bob")  - counting starts at 0!
• zombies.append(x)   -> add to the end
• zombies.remove(x)   -> take out
• len(zombies)        -> how many
• for z in zombies:   -> loop through each one

Every game has lists: the zombies, the bullets, the coins...""",
        "code": '''import random

zombies = []
for i in range(5):
    zombies.append({"name": f"Zombie #{i + 1}", "health": random.randint(20, 60)})

print(f"{len(zombies)} zombies rise from their graves! 🧟")

# Shoot random zombies until none are left
shots = 0
while zombies:                      # an empty list counts as False
    target = random.choice(zombies)
    target["health"] -= 25
    shots += 1
    if target["health"] <= 0:
        zombies.remove(target)
        print(f"🔫 {target['name']} is down! {len(zombies)} left")

print(f"All clear in {shots} shots!")
''',
        "challenge": "Make a list of 3 weapon names and use a for loop to print each one with an emoji.",
        "quiz": {"q": 'If guns = ["laser", "sword", "rocket"], what is guns[1]?',
                 "options": ["laser", "sword", "rocket", "Error"], "answer": 1,
                 "why": "Lists start counting at 0, so [0] is laser and [1] is sword."},
    },
    # ------------------------------------------------------------------ 2D WINDOW
    {
        "id": "2d1", "track": TRACK_2D, "title": "1. Your first game window",
        "text": """Every game has a GAME LOOP that runs about 60 times per second:

    1. Check events  (keys pressed? window closed?)
    2. Update        (move things)
    3. Draw          (paint the screen, then flip it to show it)

Colors are (Red, Green, Blue) from 0 to 255. (255, 0, 0) is red.
Screen position (0, 0) is the TOP-LEFT corner. y goes DOWN.""",
        "code": '''import pygame

pygame.init()
screen = pygame.display.set_mode((800, 600))     # width, height in pixels
pygame.display.set_caption("My first window!")
clock = pygame.time.Clock()

running = True
while running:
    # 1. EVENTS
    for event in pygame.event.get():
        if event.type == pygame.QUIT:      # the X button
            running = False

    # 2. UPDATE (nothing moves yet)

    # 3. DRAW
    screen.fill((15, 15, 35))                                       # dark blue sky
    pygame.draw.circle(screen, (255, 240, 180), (650, 120), 60)     # big moon at x=650, y=120
    pygame.draw.rect(screen, (30, 90, 40), (0, 500, 800, 100))      # grass (x, y, width, height)
    pygame.draw.rect(screen, (120, 120, 130), (200, 420, 50, 80))   # tombstone
    pygame.display.flip()                                           # show what we drew

    clock.tick(60)                         # max 60 frames per second

pygame.quit()
''',
        "challenge": "Add 3 more tombstones and change the sky color. Can you draw stars with small circles?",
        "quiz": {"q": "In pygame, where is (0, 0) on the screen?",
                 "options": ["Center", "Bottom-left", "Top-left", "Top-right"], "answer": 2,
                 "why": "x goes right and y goes DOWN from the top-left corner."},
    },
    {
        "id": "2d2", "track": TRACK_2D, "title": "2. Move a player with the keyboard",
        "text": """To move something, change its x and y a little bit EVERY frame.

• pygame.key.get_pressed() tells you which keys are held down right now.
• We use 'dt' (delta time = seconds since last frame) so speed is the same
  on fast and slow PCs:  x += speed * dt
• max() and min() keep the player inside the screen.""",
        "code": '''import pygame

pygame.init()
screen = pygame.display.set_mode((800, 600))
pygame.display.set_caption("WASD to move, SHIFT to sprint")
clock = pygame.time.Clock()

x, y = 400, 300
size = 40
speed = 250          # pixels per second

running = True
while running:
    dt = clock.tick(60) / 1000          # seconds since last frame (about 0.016)

    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False

    keys = pygame.key.get_pressed()
    current_speed = speed * 2 if keys[pygame.K_LSHIFT] else speed   # sprint!
    if keys[pygame.K_a] or keys[pygame.K_LEFT]:
        x -= current_speed * dt
    if keys[pygame.K_d] or keys[pygame.K_RIGHT]:
        x += current_speed * dt
    if keys[pygame.K_w] or keys[pygame.K_UP]:
        y -= current_speed * dt
    if keys[pygame.K_s] or keys[pygame.K_DOWN]:
        y += current_speed * dt

    # Stay inside the window
    x = max(0, min(x, 800 - size))
    y = max(0, min(y, 600 - size))

    screen.fill((20, 20, 30))
    pygame.draw.rect(screen, (0, 255, 120), (x, y, size, size))
    pygame.display.flip()

pygame.quit()
''',
        "challenge": "Add a red square 'zombie' that slowly moves toward the player every frame. (Hint: if zombie_x < x: zombie_x += ...)",
        "quiz": {"q": "Why do we multiply speed by dt?",
                 "options": ["To make it faster", "So the game runs the same speed on any PC", "pygame requires it", "To save memory"],
                 "answer": 1, "why": "A fast PC has more frames with smaller dt, a slow PC fewer frames with bigger dt - same speed overall."},
    },
    {
        "id": "2d3", "track": TRACK_2D, "title": "3. Shooting + hitting things (collisions)",
        "text": """Shooting = make a bullet, keep it in a LIST, move all bullets every frame.
Hitting = check if two rectangles overlap:  bullet.colliderect(zombie)

pygame.Rect(x, y, width, height) is a rectangle with handy tools built in.
IMPORTANT trick: loop over a COPY of a list ( list[:] ) when removing items from it.""",
        "code": '''import random
import pygame

pygame.init()
screen = pygame.display.set_mode((800, 600))
pygame.display.set_caption("SPACE to shoot, A/D to move")
clock = pygame.time.Clock()
font = pygame.font.SysFont(None, 40)

player = pygame.Rect(380, 540, 40, 40)
bullets = []
zombies = []
score = 0
spawn_timer = 0

running = True
while running:
    dt = clock.tick(60) / 1000
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
        if event.type == pygame.KEYDOWN and event.key == pygame.K_SPACE:
            bullets.append(pygame.Rect(player.centerx - 3, player.top - 12, 6, 12))

    keys = pygame.key.get_pressed()
    if keys[pygame.K_a]:
        player.x -= 400 * dt
    if keys[pygame.K_d]:
        player.x += 400 * dt
    player.clamp_ip(screen.get_rect())          # keep inside the screen

    # Spawn a zombie every second
    spawn_timer += dt
    if spawn_timer > 1:
        spawn_timer = 0
        zombies.append(pygame.Rect(random.randint(0, 760), -40, 40, 40))

    for b in bullets[:]:
        b.y -= 600 * dt
        if b.bottom < 0:
            bullets.remove(b)

    for z in zombies[:]:
        z.y += 120 * dt
        if z.colliderect(player) or z.top > 600:
            running = False          # a zombie reached you!
        for b in bullets[:]:
            if z.colliderect(b):     # HIT!
                zombies.remove(z)
                bullets.remove(b)
                score += 1
                break

    screen.fill((15, 15, 30))
    pygame.draw.rect(screen, (0, 255, 120), player)
    for b in bullets:
        pygame.draw.rect(screen, (120, 255, 120), b)
    for z in zombies:
        pygame.draw.rect(screen, (60, 140, 60), z)
        pygame.draw.rect(screen, (255, 0, 0), (z.x + 8, z.y + 10, 6, 6))    # glowing eyes 👀
        pygame.draw.rect(screen, (255, 0, 0), (z.x + 26, z.y + 10, 6, 6))
    screen.blit(font.render(f"Score: {score}", True, (255, 255, 255)), (10, 10))
    pygame.display.flip()

print("Final score:", score)
pygame.quit()
''',
        "challenge": "Give the player 3 lives instead of instant game over, and show the lives on screen.",
        "quiz": {"q": "Why do we loop over bullets[:] instead of bullets when removing?",
                 "options": ["It's faster", "Removing from a list while looping over it skips items", "It sorts them", "No difference"],
                 "answer": 1, "why": "bullets[:] is a copy, so removing from the real list doesn't confuse the loop."},
    },
    # ------------------------------------------------------------------ 3D
    {
        "id": "3d1", "track": TRACK_3D, "title": "1. x, y, z - the 3 directions",
        "text": """2D has x (left/right) and y (up/down). 3D adds z (forward/back).

In Ursina:
    x  = left (-) / right (+)
    y  = down (-) / up (+)          <- y is UP in 3D (not down like pygame!)
    z  = back (-) / forward (+)

An Entity is anything in the 3D world: a cube, the ground, a zombie.
update() is your game loop - Ursina calls it every frame for you.
time.dt is the same 'delta time' idea as in 2D.

🖱️ In this demo: hold RIGHT mouse button + move to spin the camera, scroll to zoom.""",
        "code": '''from ursina import *
import math

app = Ursina()

ground = Entity(model='plane', scale=20, color=color.dark_gray)

red_cube = Entity(model='cube', color=color.red, position=(-3, 0.5, 0))      # LEFT
green_cube = Entity(model='cube', color=color.green, position=(0, 3, 0))     # UP high
blue_cube = Entity(model='cube', color=color.azure, position=(0, 0.5, 4))    # FORWARD
yellow_cube = Entity(model='cube', color=color.yellow, position=(3, 0.5, 0)) # RIGHT

Text("Hold right mouse to look around, scroll to zoom", position=(-0.85, 0.47))
EditorCamera()      # lets you fly the camera around with the mouse


def update():
    green_cube.rotation_y += 90 * time.dt                    # spin 90 degrees per second
    red_cube.y = 0.5 + abs(math.sin(time.time() * 3))        # bounce up and down


app.run()
''',
        "challenge": "Add a purple cube BEHIND the start (negative z) and make the blue cube slowly grow with blue_cube.scale += time.dt * 0.1",
        "quiz": {"q": "In Ursina 3D, which letter is UP?",
                 "options": ["x", "y", "z", "w"], "answer": 1,
                 "why": "y is up in 3D. x is left/right, z is forward/back."},
    },
    {
        "id": "3d2", "track": TRACK_3D, "title": "2. First-person walking",
        "text": """A FIRST-PERSON game puts the camera inside the player's head.
Ursina has a ready-made FirstPersonController: WASD to walk, mouse to look, Space to jump.

• collider='box' makes things solid so you can't walk through them.
• Sky() adds a sky.
• def input(key): runs once whenever a key is pressed.

Press ESC to quit the demo.""",
        "code": '''from ursina import *
from ursina.prefabs.first_person_controller import FirstPersonController
import random

app = Ursina()

ground = Entity(model='plane', scale=40, texture='grass', texture_scale=(10, 10), collider='box')

# 4 walls around the edge: (x, z, width, depth)
for x, z, w, d in [(0, 20, 40, 1), (0, -20, 40, 1), (20, 0, 1, 40), (-20, 0, 1, 40)]:
    Entity(model='cube', position=(x, 2, z), scale=(w, 4, d), color=color.gray,
           texture='brick', collider='box')

# Random blocks to walk around and jump on
for i in range(15):
    Entity(model='cube', texture='brick', color=color.light_gray, collider='box',
           position=(random.uniform(-15, 15), 1, random.uniform(-15, 15)), scale=2)

player = FirstPersonController()
player.speed = 6
Sky()


def input(key):
    if key == 'escape':
        application.quit()


app.run()
''',
        "challenge": "Make the player sprint: in update(), set player.speed = 12 if held_keys['shift'] else 6",
        "quiz": {"q": "What does collider='box' do?",
                 "options": ["Makes it a box shape", "Makes it solid so you bump into it", "Makes it invisible", "Gives it a texture"],
                 "answer": 1, "why": "Without a collider you walk right through things like a ghost 👻."},
    },
    {
        "id": "3d3", "track": TRACK_3D, "title": "3. Aiming + shooting in 3D (raycasts)",
        "text": """How do 3D shooters know what you hit? A RAYCAST:
an invisible laser line shot from the camera forward. Whatever it touches first = hit!

    hit = raycast(start, direction, distance=100, ignore=(player,))
    if hit.hit:  ...  hit.entity is the thing you hit

This is the SAME idea your zombie game's laser gun will use. 🔫
Click to shoot the orange targets. ESC to quit.""",
        "code": '''from ursina import *
from ursina.prefabs.first_person_controller import FirstPersonController
import random

app = Ursina()

ground = Entity(model='plane', scale=40, texture='grass', texture_scale=(10, 10), collider='box')
player = FirstPersonController()
Sky()

targets = []
for i in range(10):
    targets.append(Entity(model='cube', color=color.orange, collider='box',
                          position=(random.uniform(-12, 12), random.uniform(1, 4), random.uniform(6, 18))))

score = 0
score_text = Text(f"Score: {score}", position=(-0.85, 0.45), scale=2)


def input(key):
    global score
    if key == 'left mouse down':
        # Shoot an invisible ray from your eyes straight forward
        hit = raycast(camera.world_position, camera.forward, distance=100, ignore=(player,))
        if hit.hit and hit.entity in targets:
            targets.remove(hit.entity)
            destroy(hit.entity)
            score += 1
            score_text.text = f"Score: {score}"
    if key == 'escape':
        application.quit()


def update():
    for t in targets:
        t.rotation_y += 45 * time.dt


app.run()
''',
        "challenge": "Make each target take 3 hits instead of 1. (Hint: give each target a hp variable: t.hp = 3)",
        "quiz": {"q": "What is a raycast?",
                 "options": ["A type of 3D model", "An invisible line that finds what it touches first", "A sound effect", "A camera"],
                 "answer": 1, "why": "It's like an invisible laser beam - perfect for guns and for checking what's in front of you."},
    },
    {
        "id": "3d4", "track": TRACK_3D, "title": "4. Bonus: what is 4D? 🤯",
        "text": """We live in 3D. A 4th direction (called w) would point somewhere we can't see.

The trick: we can't see 4D, but we can see its SHADOW. A 3D cube casts a 2D shadow.
A 4D cube (a "tesseract") casts a 3D shadow - that's what you see here, drawn on your 2D screen.

When it rotates through w, the inside cube and outside cube swap places. That's not a glitch,
that's 4D rotation! A "4D game" usually means you slide through w and see a different
3D slice of the world - like walls appearing and disappearing.

SPACE = toggle 4D rotation on/off.""",
        "code": '''import itertools
import math

import pygame

pygame.init()
screen = pygame.display.set_mode((800, 600))
pygame.display.set_caption("Tesseract - a 4D cube! SPACE toggles 4D spin")
clock = pygame.time.Clock()

# 16 corners: every mix of -1 and +1 for x, y, z, w
points = [list(p) for p in itertools.product((-1, 1), repeat=4)]
# Two corners are connected if they differ in exactly ONE direction
edges = [(i, j) for i in range(16) for j in range(i + 1, 16)
         if sum(a != b for a, b in zip(points[i], points[j])) == 1]


def rotate(p, a, b, angle):
    """Spin point p in the plane made by directions a and b (0=x, 1=y, 2=z, 3=w)."""
    p = p[:]
    c, s = math.cos(angle), math.sin(angle)
    p[a], p[b] = p[a] * c - p[b] * s, p[a] * s + p[b] * c
    return p


def project(p):
    x, y, z, w = p
    k4 = 1 / (3 - w)              # 4D -> 3D: further away in w = smaller
    x, y, z = x * k4, y * k4, z * k4
    k3 = 1 / (3 - z)              # 3D -> 2D: further away in z = smaller
    return (400 + x * k3 * 900, 300 + y * k3 * 900), w


angle = 0
spin_4d = True
running = True
while running:
    dt = clock.tick(60) / 1000
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
        if event.type == pygame.KEYDOWN and event.key == pygame.K_SPACE:
            spin_4d = not spin_4d

    angle += dt * 0.8
    projected = []
    for p in points:
        q = rotate(p, 0, 2, angle * 0.5)          # normal 3D spin (x-z plane)
        if spin_4d:
            q = rotate(q, 0, 3, angle)            # 4D spin (x-w plane)!
            q = rotate(q, 1, 3, angle * 0.6)      # 4D spin (y-w plane)!
        projected.append(project(q))

    screen.fill((10, 10, 20))
    for i, j in edges:
        (a, wa), (b, wb) = projected[i], projected[j]
        glow = int(120 + 60 * (wa + wb))           # color shows how far in w the edge is
        glow = max(40, min(255, glow))
        pygame.draw.line(screen, (0, glow, 255 - glow // 2), a, b, 2)
    for (pos, w) in projected:
        pygame.draw.circle(screen, (255, 255, 255), (int(pos[0]), int(pos[1])), 4)
    pygame.display.flip()

pygame.quit()
''',
        "challenge": "Try rotating in the z-w plane too: rotate(q, 2, 3, angle). What changes?",
        "quiz": {"q": "How many corners does a 4D cube have?",
                 "options": ["8", "12", "16", "24"], "answer": 2,
                 "why": "Each new dimension doubles the corners: 2D square 4, 3D cube 8, 4D tesseract 16."},
    },
]

# ------------------------------------------------------------------ ZOMBIE GAME BUILD GUIDE
# No game code here on purpose! Each step = what to build + a button that asks CodeBrain to coach you.
ZOMBIE_STEPS = [
    ("Ground, sky + you", "Make a dark ground plane, a night sky and a FirstPersonController. "
     "Make the sky dark with window.color or a dark Sky color.",
     "Teach me step 1 of my Graveyard Zombies game: a dark night ground, a sky and a first-person player I can walk with WASD. Explain every line."),
    ("Graveyard look", "Add tombstones (cubes), fog (scene.fog_density) and a big glowing moon.",
     "Teach me step 2 of Graveyard Zombies: add random tombstones, fog and a big glowing moon to my game. Show me what to add to my current code."),
    ("Laser gun 🔫", "Shoot with left click using a raycast (like lesson 3D-3). Draw a short laser line so you can see it.",
     "Teach me step 3: a laser gun that shoots with left click using raycast, with a visible laser beam that disappears quickly."),
    ("One zombie 🧟", "Make ONE blocky zombie with red glowing eyes that walks toward you every frame (look_at + move forward).",
     "Teach me step 4: one blocky zombie with red glowing eyes that chases me. How does it face me and walk toward me?"),
    ("Health + game over", "The zombie hurts you when close. Show a health bar. Health 0 = game over screen.",
     "Teach me step 5: player health, a health bar, zombies hurting me when they're close, and a game over screen."),
    ("Waves from graves", "Spawn zombies in waves, rising up out of the ground. Each wave has more. Some are fast runners.",
     "Teach me step 6: zombie waves that rise out of graves, more each wave, and some fast runner zombies."),
    ("Sword ⚔️", "Press a key or right click to swing a sword. Hits zombies that are close in front of you.",
     "Teach me step 7: a sword attack that hits zombies close in front of me with a swing animation."),
    ("HUD + minimap", "Wave number, kill counter, coins, damage numbers popping up, and a minimap with red dots.",
     "Teach me step 8: a HUD with wave number, kills, coins, popping damage numbers and a minimap with red dots for zombies."),
    ("Coins + shop 🛒", "Zombies drop coins (and sometimes health). Between waves open a shop: laser damage, max health, sword range, speed boots. Laser color changes with upgrades.",
     "Teach me step 9: coins + health pickups dropped by zombies, and an upgrade shop between waves (laser damage changes laser color green->blue->purple->gold, max health, sword range, speed boots)."),
    ("BOSS 💀", "Every 5 waves: a giant boss with a health bar. Ground slam (jump over the shockwave), summons minions, throws tombstones. Gets harder as it gets hurt.",
     "Teach me step 10: a boss zombie every 5 waves with a big health bar, ground slam shockwave, summoning minions and throwing tombstones, getting harder as its health drops."),
    ("Menus + difficulty", "Main menu (Play/Settings/Quit), Esc pause menu, mouse sensitivity slider, Easy/Normal/Nightmare.",
     "Teach me step 11: main menu, pause menu with Esc, a mouse sensitivity slider and Easy/Normal/Nightmare difficulty."),
    ("Spooky extras 🌩️", "Sprint, crouch, flashlight on F, lightning flashes, and sounds made with code.",
     "Teach me step 12: sprint, crouch, a flashlight on F, random lightning flashes, and simple sound effects generated with code (no sound files)."),
    ("High score 🏆", "Endless mode: save your best wave/kills to a file and show it on the menu.",
     "Teach me step 13: save my high score to a file and show it on the main menu."),
]

for n, (title, text, ask) in enumerate(ZOMBIE_STEPS, start=1):
    LESSONS.append({
        "id": f"zg{n}", "track": TRACK_ZOMBIE, "title": f"Step {n}: {title}",
        "text": text + "\n\n💡 YOU build this one. Press 'Ask CodeBrain' and it will teach you how, "
                       "then type it into your own file in the editor.\nPress 'I did it ✅' when it works!",
        "code": "", "challenge": "", "quiz": None, "ask": ask,
    })


def by_id(lesson_id):
    for lesson in LESSONS:
        if lesson["id"] == lesson_id:
            return lesson
    return None


def in_track(track):
    return [l for l in LESSONS if l["track"] == track]
