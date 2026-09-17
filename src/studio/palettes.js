// One definition per palette. Collection sizes follow the color composition;
// there are no shortened variants that can overwrite the full set of inks.
const palette = (name, note, colors) => ({ name, note, colors: colors.split(" ").map(color => `#${color}`) });
export const paletteGroups = [
  { name: "Ink & light", items: [
    palette("Paper", "Soft black & warm white", "101215 f1f2e9"),
    palette("Pure BW", "Pure black & white", "000000 ffffff"),
    palette("Carbon", "A neutral grayscale with gentle midtones", "101010 363636 696969 a1a1a1 d6d6d6 f5f5f5"),
    palette("Toner red", "Black, vermilion & uncoated paper", "171616 f0321a f4e7c9"),
    palette("Indigo wash", "Deep indigo through misty blue to rice paper", "172740 344e72 718da1 b3c7ce f1ede2"),
    palette("Oxide", "Burnt umber, red clay & chalk", "332824 984936 d68a68 f0d1ad f8edda"),
    palette("Phosphor", "Forest shadows & luminous green", "071912 315c36 8ca942 dbf69b"),
    palette("Amber", "Warm sepia & glowing gold", "181108 744c1b cd933e ffe0a0"),
    palette("Electric", "Violet ink & pale lavender", "11101a 523cff eaa3ff f6f1ff"),
    palette("Acid ink", "Olive shadows & sharp lemon yellow", "20251b 5f704a a4b76e f4ff64"),
  ] },
  { name: "Pigment & paper", items: [
    palette("Gouache", "Cobalt, jade, warm red & ochre", "152b69 2257b8 25896b d94d35 ee9689 efb63d f4e6cb"),
    palette("Mineral", "Patinated green, clay & limestone", "162f3a 27656d 559c91 b6c8a0 d79d62 b95c43 eee2c5"),
    palette("Silk", "Muted blue, rose & golden thread", "192441 39599a 528d9b b36783 dc927c e9bf77 f3e7cd"),
    palette("Cathedral", "Jewel tones with antique gold", "162335 4c345d 146974 3e8a9c ba5846 d5a353 d2ddd0"),
    palette("Candy lacquer", "Orchid, coral, sea glass & cream", "35234d 7550a6 e45b84 f2935c 6bbcae f3ce61 f6ead7"),
    palette("Mocha Indulgence", "Espresso, walnut & warm cream", "30231f 694634 a57650 d2aa7e f1d9ba fff4e7"),
    palette("Sunset Glow", "Petrol blue, terracotta & honey", "264653 2a9d8e e76f51 f4a261 e9c46a f6ebcf"),
    palette("Ocean Breeze", "Marine blue & sea foam with a coral accent", "011f4b 035b80 288caa 79b4bf b9d8dc e98973 f5eee0"),
    palette("Peach Fuzz", "Plum shadows, peach & soft linen", "5d3847 b65f57 ff9980 f5cac3 ffe5d9 faf0e6"),
    palette("Modern Heritage", "Forest green, lacquer red & parchment", "172b32 285f3c 0a8a5a 005ecc e04856 e9b544 e7c5c3 f8f2ea"),
  ] },
  { name: "Graphic & textile", items: [
    palette("Spectral print", "Bright print inks on warm paper", "2324d9 ee4c92 f47d22 ffe55c 54c6d4 439357 f4ecdd"),
    palette("Loom primary", "Black, primary inks & hot pink", "191919 0070f6 ff0000 00af57 ff69a2 fbbb00"),
    palette("Loom textile", "A broad woven palette of brights & soft neutrals", "2d2d2d 99270d 2677d9 1ea963 e83014 ff6e26 aecce5 cecece ffcf43 efe3da"),
    palette("Loom nocturne", "Earth red, cool green & rose on black", "060606 8c301b d53d25 498e75 3175d5 e979ab cececc"),
    palette("Cobalt vermilion", "Cobalt & sky blue against vermilion", "103eac 60b5de f44913 f7f6ed"),
    palette("Signal pop", "Blue, hot pink, orange & chartreuse", "152939 155fd5 f34980 fe893b d8e940 fff4d5"),
    palette("Aubergine citrus", "Deep purple, lilac & a citron accent", "302238 846392 c5b4d1 d8dc69 f4eddc"),
    palette("Moss rose", "Forest green & dusty rose with a warm ground", "253c32 677b58 acb58b b56b7c e6b5b2 f4e6d5"),
    palette("Terracotta tide", "Prussian blue meets warm clay", "173e50 337c8d 87b9b3 b84f35 e59b70 f5dfbb"),
  ] },
  { name: "Electric & screen", items: [
    palette("Black & Green", "Black & fluorescent green", "000000 32ff00"),
    palette("Channel Colors", "Lime & ultramarine with neutral anchors", "000000 3300ff 32ff00 d5d5d5 ffffff"),
    palette("Decade", "Ten original digital signal colors", "000000 ffffff d5d5d5 32ff00 3300ff ff0000 00ffff ffa500 ff00ff 008080"),
    palette("RGB Primaries", "Full additive primaries & complements", "000000 0000ff ff0000 00ff00 ff00ff 00ffff ffff00 ffffff"),
    palette("High Contrast", "Black & white with warning red & yellow", "000000 ff3434 ffeb00 ffffff"),
    palette("Hot Dream Pop", "Violet, bubblegum & tangerine", "311b62 6237d8 b18ae9 ff6299 ff9e65 ffe754 f8eefa"),
    palette("Graphic Ticket Neon", "Clear signage colors & cream", "141414 0055ff 00b0ff 00e86b ff2d2d ff7a00 fff82a fef9f0"),
    palette("Vaporwave Aurora", "Ultraviolet, pink & luminous cyan", "2e2b5f 7650a8 ff71ce f5b3ff 7af9ff 6dfcbf f9f871 f0efff"),
    palette("Pastel Goth Midnight", "Charcoal, lavender, blush & pale mint", "2b2c34 474554 a393ff f5c7f7 ffbaae baffd5 f7ead4"),
    palette("Brutalist Neon Clash", "Hard black, acid yellow, red & turquoise", "000000 ff006e fb5607 ffba08 00f5d4 ffffff"),
    palette("Eco-Tech Future", "Deep evergreen, teal & electric lime", "173e36 006d77 0081a7 83c5be aacc00 edf6f9"),
    palette("Analog Sunset", "Twilight violet, warm neon & electric blue", "2e1a47 a13277 e04437 ff792f ffcc56 276de0 51c7d1 ffeedf"),
  ] },
];
export const paletteCatalog = paletteGroups.flatMap(group => group.items.map(item => ({ ...item, group: group.name })));
export const palettes = Object.fromEntries(paletteCatalog.map(({ name, colors }) => [name, colors]));
// Default and Decade previously contained exactly the same ten colors.
export const resolvePaletteName = name => name === "Default" ? "Decade" : name;
