// Application constants and palettes

export const presetColors = [
  { label: 'White', value: '#FFFFFF' },
  { label: 'Black', value: '#000000' },
  { label: 'Blurple', value: '#3300FF' },
  { label: 'Neon Greene', value: '#32FF00' },
  { label: 'GrÆ', value: '#D5D5D5' },
];

export const effects = [
  'two-tone', 'binary', 'decade', 'ascii', 'dither', 'dither-ascii',
  'green-screen',
  'binary-char', 'letter-char', 'letters-palette', 'palette', 'edge'
];

export const fonts = [
  'monospace','Courier New','Arial','Verdana','Tahoma','Georgia','Times New Roman','Comic Sans MS','Impact'
];

export const palette10 = [
  '#000000','#FFFFFF','#D5D5D5','#32FF00','#3300FF','#FF0000','#00FFFF','#FFA500','#FF00FF','#008080'
];

export const palette5 = ['#32FF00','#3300FF','#D5D5D5','#FFFFFF','#000000'];

export const decadePalettes = {
  Default: palette10,
};

export const charPalettes = {
  Default: palette10,
  'Pure BW': ['#000000','#FFFFFF'],
  'Black & Green': ['#000000','#32FF00'],
  'Channel Colors': palette5,
  'Sunset Glow': ['#264653','#2a9d8e','#e9c46a','#f4a261','#e76f51','#d62828','#f77f00','#fcbf49','#eae2b7','#003049'],
  'Ocean Breeze': ['#011f4b','#03396c','#005b96','#1874cd','#6497b1','#b3cde0','#f7f7f7','#ffefd5','#ffa07a','#e76f51'],
  'Peach Fuzz': ['#ff6f61','#ff9966','#ffcc5c','#ffee93','#faf0e6','#f5cac3','#eae7dc','#ffe5d9','#ffd7ba','#fcbf49'],
  'RGB Primaries': ['#FF0000','#00FF00','#0000FF','#FFFF00','#00FFFF','#FF00FF','#000000','#FFFFFF','#808080','#C0C0C0'],
  'High Contrast': ['#000000','#FFFFFF','#FF0000','#00FF00','#0000FF','#FFFF00','#00FFFF','#FF00FF','#808080','#404040'],
  'Decade': palette10,
  'Hot Dream Pop': ['#FF6230','#FD9BFB','#F8BCCA','#FFBE98','#7669E9','#5E1AF4','#3300FF','#32FF00','#FFE754','#FFFFFF'],
  'Graphic Ticket Neon': ['#141414','#FEF9F0','#00B0FF','#00E86B','#FFF82A','#FF2D2D','#FF7A00','#A032FF','#0055FF','#F7D3C0'],
  'Modern Heritage': ['#0A8A5A','#285F3C','#FFE646','#FB2850','#005ECC','#E7DFFF','#F8F2EA','#FAE1EB','#101318','#FF8730'],
  'Mocha Indulgence': ['#8B5A2B','#5C3B1E','#D4B28F','#F7E6D1','#C09F80','#FFD6A6','#FFF8F4','#AE7C4F','#A67C00','#49362E'],
  'Vaporwave Aurora': ['#FF71CE','#F5B3FF','#B2FAFF','#7AF9FF','#6DFCBF','#F9F871','#FEC868','#FF9EB5','#FF57A1','#2E2B5F'],
  'Pastel Goth Midnight': ['#2B2C34','#474554','#A393FF','#F5C7F7','#FFC6AC','#FCE38A','#BAFFB4','#B9FFFF','#8EC5FC','#FF9AA2'],
  'Brutalist Neon Clash': ['#000000','#FFFFFF','#FF006E','#FFBA08','#00F5D4','#8338EC','#3A86FF','#FB5607','#FF1B1C','#E9ECEF'],
  'Eco-Tech Future': ['#006D77','#83C5BE','#EDF6F9','#FFDDD2','#E29578','#1B4332','#AACC00','#0081A7','#00AF54','#2C3E50'],
  'Analog Sunset': ['#FF9E00','#FF612F','#E02020','#FF66C4','#D22BFF','#2E1A47','#0066FF','#00C2FF','#FFD54F','#FFEEDF'],
};

export const palette5Sets = {
  'Channel Colors': palette5,
  'Sunset Glow': ['#264653','#e9c46a','#f4a261','#e76f51','#d62828'],
  'Ocean Breeze': ['#011f4b','#03396c','#005b96','#1874cd','#6497b1'],
  'Peach Fuzz': ['#ff6f61','#ff9966','#ffcc5c','#ffee93','#faf0e6'],
  'RGB Primaries': ['#FF0000','#00FF00','#0000FF','#FFFF00','#00FFFF'],
  'High Contrast': ['#000000','#FFFFFF','#FF0000','#00FF00','#0000FF'],
  'Hot Dream Pop': ['#FF6230','#FD9BFB','#5E1AF4','#32FF00','#3300FF'],
  'Graphic Ticket Neon': ['#141414','#FEF9F0','#00B0FF','#00E86B','#FF2D2D'],
  'Modern Heritage': ['#0A8A5A','#FFE646','#FB2850','#005ECC','#F8F2EA'],
  'Mocha Indulgence': ['#8B5A2B','#D4B28F','#FFD6A6','#A67C00','#49362E'],
  'Vaporwave Aurora': ['#FF71CE','#B2FAFF','#6DFCBF','#F9F871','#2E2B5F'],
  'Pastel Goth Midnight': ['#2B2C34','#A393FF','#F5C7F7','#FCE38A','#BAFFB4'],
  'Brutalist Neon Clash': ['#000000','#FF006E','#00F5D4','#FFBA08','#E9ECEF'],
  'Eco-Tech Future': ['#006D77','#83C5BE','#E29578','#AACC00','#2C3E50'],
  'Analog Sunset': ['#FF9E00','#E02020','#FF66C4','#0066FF','#2E1A47'],
};

export const paletteSets = {
  Decade: palette10,
  'Mocha Indulgence': ['#8B5A2B','#5C3B1E','#D4B28F','#F7E6D1','#C09F80','#FFD6A6','#FFF8F4','#AE7C4F','#A67C00','#49362E'],
  'Vaporwave Aurora': ['#FF71CE','#F5B3FF','#B2FAFF','#7AF9FF','#6DFCBF','#F9F871','#FEC868','#FF9EB5','#FF57A1','#2E2B5F'],
  'Pastel Goth Midnight': ['#2B2C34','#474554','#A393FF','#F5C7F7','#FFC6AC','#FCE38A','#BAFFB4','#B9FFFF','#8EC5FC','#FF9AA2'],
  'Brutalist Neon Clash': ['#000000','#FFFFFF','#FF006E','#FFBA08','#00F5D4','#8338EC','#3A86FF','#FB5607','#FF1B1C','#E9ECEF'],
  'Eco-Tech Future': ['#006D77','#83C5BE','#EDF6F9','#FFDDD2','#E29578','#1B4332','#AACC00','#0081A7','#00AF54','#2C3E50'],
  'Analog Sunset': ['#FF9E00','#FF612F','#E02020','#FF66C4','#D22BFF','#2E1A47','#0066FF','#00C2FF','#FFD54F','#FFEEDF'],
  ...palette5Sets
};

export const asciiVariants = {
  Default: ['@','#','8','&','o',':','.',' '],
  'Block Shades': ['░','▒','▓','█'],
  Braille: ['⠁','⠃','⠇','⠧','⠷','⠿'],
  Dots: ['.','·','•','‧'],
  'Box Drawing': ['─','│','┌','┐','└','┘','├','┤','┬','┴','┼'],
  Quadrants: ['▘','▝','▖','▗','▚','▛','▜','▟'],
  Chess: ['♔','♕','♖','♗','♘','♙','♚','♛','♜','♝','♞','♟'],
  Shapes: ['■','□','▲','▼','◆','◇','○','●','◯','◉','◎','◈'],
  Math: ['+','-','×','÷','=','~','≈','±','∞','√','∑','∏'],
  Emojis: ['😊','😂','😍','😎','🤖','👍','🌟','🎵','🔥','✨'],
  'Squares & lines': ['▢','▣','▤','▥','▦','▧','▨','▩','░','▒','▓','█','▀','▄','▌','▐','▘','▝','▖','▗','▚','▞','▛','▜','▟','┌','┬','┐','─','┼','─','╔','╦','╗','═','╩','╝','╚','╩','═','/','\\','|','+','•'],
  Arrows: ['↑','↓','←','→','↔','↖','↗','↘','↙','⇠','⇢','⇳','⇶','⟴','⤱','•'],
  Marathon: ['·','□','○','×','△','◦','◎'],
  'Marathon v2': ['·','□','○','×','△','◦','+','-'],
  'Marathon v3': ['·','□','×','△','◦','+','-','/','⚬','⦾'],
};
