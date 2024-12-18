extends Node

var music_theme: AudioStreamPlayer
var sfx_player: AudioStreamPlayer
var is_music_muted: bool = false

func _ready():
    music_theme = AudioStreamPlayer.new()
    add_child(music_theme)
    # Define o volume para 50% (-6 dB é aproximadamente metade do volume)
    music_theme.volume_db = -6.0
    
    # Configura o player de SFX com volume 20% maior (+1.6 dB)
    sfx_player = AudioStreamPlayer.new()
    add_child(sfx_player)
    sfx_player.volume_db = 1.6

func play_music(stream: AudioStream):
    music_theme.stream = stream
    if !is_music_muted:
        music_theme.play()

func stop_music():
    music_theme.stop()

func toggle_music_mute():
    is_music_muted = !is_music_muted
    if is_music_muted:
        music_theme.stop()
    elif music_theme.stream != null:
        music_theme.play()

func play_sfx(stream: AudioStream):
    sfx_player.stream = stream
    sfx_player.play()

func stop_sfx():
    sfx_player.stop() 