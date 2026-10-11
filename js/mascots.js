// ======= mascots.js — the seven original SVG characters, drawn in code =======
// All share one rig (viewBox 0 0 120 120): head centred near (60,44), body below, arms in
// groups that CSS can rotate, so every mascot has the same states and can wear accessories.
// States: idle, celebrate, big, sleepy, hopeful, tired, float (Otto), night (Otto + torch).

const Mascot = (() => {
  const INK = '#24160F';

  function eyes(style, [lx, ly], [rx, ry], r = 4, ring = null) {
    const ringHtml = ring ? `<circle cx="${lx}" cy="${ly}" r="${r + 2.6}" fill="${ring}"/><circle cx="${rx}" cy="${ry}" r="${r + 2.6}" fill="${ring}"/>` : '';
    let inner;
    switch (style) {
      case 'happy':
        inner = `<path d="M${lx - r} ${ly + 1} Q${lx} ${ly - r - 1} ${lx + r} ${ly + 1}" class="m-line"/>
                 <path d="M${rx - r} ${ry + 1} Q${rx} ${ry - r - 1} ${rx + r} ${ry + 1}" class="m-line"/>`; break;
      case 'closed':
        inner = `<path d="M${lx - r} ${ly} Q${lx} ${ly + r} ${lx + r} ${ly}" class="m-line"/>
                 <path d="M${rx - r} ${ry} Q${rx} ${ry + r} ${rx + r} ${ry}" class="m-line"/>`; break;
      case 'half':
        inner = `<circle cx="${lx}" cy="${ly + 1}" r="${r}" fill="${INK}"/><circle cx="${rx}" cy="${ry + 1}" r="${r}" fill="${INK}"/>
                 <path d="M${lx - r - 1} ${ly} L${lx + r + 1} ${ly}" class="m-line"/><path d="M${rx - r - 1} ${ry} L${rx + r + 1} ${ry}" class="m-line"/>
                 <rect x="${lx - r - 1}" y="${ly - r - 1.5}" width="${2 * r + 2}" height="${r + 1.4}" class="m-lid"/>
                 <rect x="${rx - r - 1}" y="${ry - r - 1.5}" width="${2 * r + 2}" height="${r + 1.4}" class="m-lid"/>`; break;
      case 'sparkle':
        inner = `<circle cx="${lx}" cy="${ly}" r="${r + 1}" fill="${INK}"/><circle cx="${rx}" cy="${ry}" r="${r + 1}" fill="${INK}"/>
                 <circle cx="${lx + 1.6}" cy="${ly - 1.6}" r="1.7" fill="#fff"/><circle cx="${rx + 1.6}" cy="${ry - 1.6}" r="1.7" fill="#fff"/>
                 <circle cx="${lx - 1.4}" cy="${ly + 1.6}" r="0.9" fill="#fff"/><circle cx="${rx - 1.4}" cy="${ry + 1.6}" r="0.9" fill="#fff"/>`; break;
      default:
        inner = `<circle cx="${lx}" cy="${ly}" r="${r}" fill="${INK}"/><circle cx="${rx}" cy="${ry}" r="${r}" fill="${INK}"/>
                 <circle cx="${lx + 1.3}" cy="${ly - 1.4}" r="1.3" fill="#fff"/><circle cx="${rx + 1.3}" cy="${ry - 1.4}" r="1.3" fill="#fff"/>`;
    }
    return `${ringHtml}<g class="m-eyes">${inner}</g>`;
  }
  function mouth(style, x, y) {
    switch (style) {
      case 'big': return `<path d="M${x - 6} ${y - 1} Q${x} ${y + 8} ${x + 6} ${y - 1} Z" fill="#7A2E2E"/><path d="M${x - 3} ${y + 3} Q${x} ${y + 5.5} ${x + 3} ${y + 3}" fill="#F08A8A"/>`;
      case 'o': return `<ellipse cx="${x}" cy="${y + 1.5}" rx="1.8" ry="2.2" fill="${INK}"/>`;
      case 'flat': return `<path d="M${x - 3} ${y + 1} L${x + 3} ${y + 1}" class="m-line"/>`;
      default: return `<path d="M${x - 4} ${y} Q${x - 2} ${y + 3} ${x} ${y} Q${x + 2} ${y + 3} ${x + 4} ${y}" class="m-line"/>`;
    }
  }
  const STYLE = {
    idle: ['open', 'smile'], celebrate: ['happy', 'big'], big: ['happy', 'big'], sleepy: ['closed', 'o'],
    hopeful: ['sparkle', 'smile'], tired: ['half', 'flat'], float: ['happy', 'smile'], night: ['open', 'smile']
  };
  const arm = (side, x, y, fill, extra = '') =>
    `<g class="m-arm m-arm-${side}" style="transform-origin:${x}px ${y}px"><ellipse cx="${x}" cy="${y + 9}" rx="6" ry="11" fill="${fill}"/>${extra}</g>`;
  const feet = (fill) => `<ellipse cx="47" cy="110" rx="9" ry="5" fill="${fill}"/><ellipse cx="73" cy="110" rx="9" ry="5" fill="${fill}"/>`;
  const cheeks = (y = 52, dx = 16) => `<circle cx="${60 - dx}" cy="${y}" r="3.6" class="m-cheek"/><circle cx="${60 + dx}" cy="${y}" r="3.6" class="m-cheek"/>`;

  // Each character: back layer (tail), body, arms, head; plus eye/mouth anchor points.
  const KINDS = {
    otter: { name: 'Giant otter', eyeL: [49, 40], eyeR: [71, 40], mouth: [60, 57], neckY: 68, draw(e, m) {
      const fur = '#6A4330', dark = '#4A2E21', cream = '#F1DDB5';
      return {
        back: `<path class="m-tail" d="M78 96 C 98 100, 112 90, 114 74 C 106 84, 94 90, 80 87 Z" fill="${dark}"/>`,
        body: `${feet(dark)}<ellipse cx="60" cy="88" rx="27" ry="25" fill="${fur}"/>
          <path d="M47 69 C 52 64, 68 64, 73 69 C 78 77, 71 84, 65 82 C 61 89, 52 87, 50 80 C 44 78, 43 72, 47 69 Z" fill="${cream}"/>`,
        armL: arm('l', 39, 73, dark), armR: arm('r', 81, 73, dark),
        head: `<circle cx="39" cy="22" r="7" fill="${fur}"/><circle cx="81" cy="22" r="7" fill="${fur}"/>
          <circle cx="39" cy="23" r="3.3" fill="${dark}"/><circle cx="81" cy="23" r="3.3" fill="${dark}"/>
          <circle cx="60" cy="44" r="28" fill="${fur}"/>
          <ellipse cx="60" cy="56" rx="16" ry="10.5" fill="#E7CDA6"/>
          ${e}<path d="M54.5 48 Q60 44.5 65.5 48 Q63.5 53.5 60 53.5 Q56.5 53.5 54.5 48 Z" fill="#2B1B12"/>
          <g stroke="${dark}" stroke-width="1" opacity=".55" stroke-linecap="round"><path d="M47 55 L35 52"/><path d="M47 58 L35 60"/><path d="M73 55 L85 52"/><path d="M73 58 L85 60"/></g>
          ${cheeks(51, 17)}${m}`
      };
    } },
    jaguar: { name: 'Jaguar', eyeL: [49, 40], eyeR: [71, 40], mouth: [60, 59], neckY: 68, draw(e, m) {
      const fur = '#F2A53A', spot = '#5A3A1A', light = '#FFF4DF';
      const ros = (x, y, r = 3.2) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#E38A26" stroke="${spot}" stroke-width="1.5"/>`;
      return {
        back: `<path class="m-tail" d="M80 98 C 100 104, 110 88, 104 72" fill="none" stroke="${fur}" stroke-width="7" stroke-linecap="round"/>
          <circle cx="104" cy="73" r="3.6" fill="${spot}"/><path d="M98 98 l3 -4 M103 90 l4 -2" stroke="${spot}" stroke-width="2.4" stroke-linecap="round"/>`,
        body: `${feet('#E2952C')}<ellipse cx="60" cy="88" rx="27" ry="25" fill="${fur}"/><ellipse cx="60" cy="93" rx="15" ry="15" fill="${light}"/>
          ${ros(41, 82)}${ros(79, 84)}${ros(47, 101, 2.6)}${ros(74, 102, 2.6)}`,
        armL: arm('l', 39, 73, fur, `<circle cx="38" cy="80" r="2" fill="${spot}"/>`), armR: arm('r', 81, 73, fur, `<circle cx="82" cy="80" r="2" fill="${spot}"/>`),
        head: `<circle cx="38" cy="22" r="8.5" fill="${fur}"/><circle cx="82" cy="22" r="8.5" fill="${fur}"/>
          <circle cx="38" cy="23" r="4" fill="${light}"/><circle cx="82" cy="23" r="4" fill="${light}"/>
          <circle cx="60" cy="44" r="28" fill="${fur}"/>
          <circle cx="52" cy="25" r="2" fill="${spot}"/><circle cx="60" cy="21" r="2.2" fill="${spot}"/><circle cx="68" cy="25" r="2" fill="${spot}"/>
          ${ros(37, 44, 2.8)}${ros(83, 44, 2.8)}
          <ellipse cx="54" cy="56" rx="8.5" ry="6.5" fill="${light}"/><ellipse cx="66" cy="56" rx="8.5" ry="6.5" fill="${light}"/>
          ${e}<path d="M56 50 L64 50 L60 55 Z" fill="#B85A55" stroke="#B85A55" stroke-linejoin="round" stroke-width="1.5"/>
          <g fill="${spot}" opacity=".5"><circle cx="51" cy="56" r=".9"/><circle cx="54" cy="58" r=".9"/><circle cx="69" cy="56" r=".9"/><circle cx="66" cy="58" r=".9"/></g>
          ${cheeks(51, 18)}${m}`
      };
    } },
    anteater: { name: 'Giant anteater', eyeL: [51, 38], eyeR: [65, 37], mouth: [100, 66], neckY: 66, draw(e) {
      const fur = '#A08E7C', dark = '#2B2522', light = '#F3EEE6', tail = '#76665A';
      return {
        back: `<path class="m-tail" d="M38 96 C 10 92, 4 62, 20 48 C 24 62, 32 76, 46 84 Z" fill="${tail}"/>
          <path d="M20 54 C 18 66, 24 80, 36 90" stroke="#8C7B6C" stroke-width="2" fill="none"/>`,
        body: `${feet(dark)}<ellipse cx="60" cy="88" rx="27" ry="25" fill="${fur}"/>
          <path d="M33 76 C 48 70, 64 77, 86 92 L 84 99 C 64 86, 48 80, 34 84 Z" fill="${dark}"/>
          <path d="M33 72 C 48 66, 64 73, 87 88" stroke="${light}" stroke-width="2.6" fill="none"/>`,
        armL: arm('l', 39, 73, light, `<rect x="33" y="84" width="12" height="3.5" rx="1.5" fill="${dark}"/>`),
        armR: arm('r', 81, 73, light, `<rect x="75" y="84" width="12" height="3.5" rx="1.5" fill="${dark}"/>`),
        head: `<circle cx="45" cy="22" r="5" fill="${fur}"/><circle cx="71" cy="21" r="5" fill="${fur}"/>
          <circle cx="58" cy="40" r="22" fill="${fur}"/>
          <path d="M68 33 C 86 40, 100 52, 107 61 C 105 66, 101 67, 97 65 C 87 59, 76 55, 64 53 Z" fill="${fur}"/>
          <ellipse cx="104" cy="63" rx="3.4" ry="2.8" fill="${dark}"/>
          ${e}${cheeks(48, 12)}`
      };
    } },
    capybara: { name: 'Capybara', eyeL: [47, 35], eyeR: [73, 35], mouth: [60, 62], neckY: 70, draw(e, m) {
      const fur = '#A9733F', dark = '#875A2F', snout = '#8E5E31';
      return {
        back: '',
        body: `${feet(dark)}<ellipse cx="60" cy="90" rx="30" ry="24" fill="${fur}"/><ellipse cx="60" cy="96" rx="18" ry="13" fill="#B98552"/>`,
        armL: arm('l', 37, 76, dark), armR: arm('r', 83, 76, dark),
        head: `<circle cx="39" cy="19" r="5.2" fill="${dark}"/><circle cx="81" cy="19" r="5.2" fill="${dark}"/>
          <rect x="32" y="17" width="56" height="52" rx="23" fill="${fur}"/>
          <rect x="38" y="44" width="44" height="25" rx="12.5" fill="${snout}"/>
          ${e}<ellipse cx="54" cy="51" rx="2.2" ry="1.5" fill="#3B2414"/><ellipse cx="66" cy="51" rx="2.2" ry="1.5" fill="#3B2414"/>
          ${cheeks(46, 20)}${m}`
      };
    } },
    tamarin: { name: 'Golden lion tamarin', eyeL: [53, 44], eyeR: [67, 44], mouth: [60, 56], neckY: 70, draw(e, m) {
      const gold = '#F28C28', mane = '#F8A848';
      let spikes = '';
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2, b = ((i + 0.5) / 18) * Math.PI * 2;
        spikes += `${i ? 'L' : 'M'}${(60 + Math.cos(a) * 35).toFixed(1)} ${(44 + Math.sin(a) * 35).toFixed(1)} L${(60 + Math.cos(b) * 27).toFixed(1)} ${(44 + Math.sin(b) * 27).toFixed(1)} `;
      }
      return {
        back: `<path class="m-tail" d="M78 100 C 104 100, 114 76, 102 60 C 98 56, 92 60, 96 64" fill="none" stroke="#E07A1C" stroke-width="6" stroke-linecap="round"/>`,
        body: `${feet('#D9741A')}<ellipse cx="60" cy="90" rx="23" ry="22" fill="${gold}"/>`,
        armL: arm('l', 42, 76, '#E07A1C'), armR: arm('r', 78, 76, '#E07A1C'),
        head: `<path d="${spikes}Z" fill="${mane}"/><circle cx="60" cy="44" r="27" fill="${gold}"/>
          <ellipse cx="60" cy="48" rx="16.5" ry="18.5" fill="#6B4A3A"/><ellipse cx="60" cy="54" rx="8" ry="6" fill="#8A6452"/>
          ${e}<ellipse cx="57.6" cy="51" rx="1.1" ry=".9" fill="#2A1A12"/><ellipse cx="62.4" cy="51" rx="1.1" ry=".9" fill="#2A1A12"/>${m}`
      };
    } },
    toucan: { name: 'Toco toucan', eyeL: [49, 37], eyeR: [69, 37], mouth: [60, 60], neckY: 66, ring: '#4CB8FF', draw(e) {
      const black = '#1E1E24';
      return {
        back: `<path class="m-tail" d="M50 104 L 60 119 L 70 104 Z" fill="${black}"/>`,
        body: `${feet('#5A6A80')}<ellipse cx="60" cy="88" rx="25" ry="26" fill="${black}"/>
          <ellipse cx="60" cy="69" rx="18" ry="11" fill="#FFFFFF"/><path d="M50 108 Q60 113 70 108 L66 104 L54 104 Z" fill="#E03131"/>`,
        armL: arm('l', 39, 74, '#2B2B33'), armR: arm('r', 81, 74, '#2B2B33'),
        head: `<circle cx="59" cy="41" r="24" fill="${black}"/><ellipse cx="59" cy="54" rx="17" ry="9" fill="#FFFFFF"/>
          ${e}
          <path d="M51 45 C 63 38, 94 42, 110 57 C 107 66, 94 64, 80 60 C 69 57, 57 57, 51 52 Z" fill="#F7931E"/>
          <path d="M53 44.5 C 67 40, 93 45, 108 56" stroke="#FFD43B" stroke-width="3" fill="none" stroke-linecap="round"/>
          <path d="M104 54 C 108 56, 111 58, 110 60 C 107 63, 104 62, 101 61 Z" fill="${black}"/>
          <path d="M51 47 Q49 50 51 52" stroke="#E03131" stroke-width="2" fill="none"/>`
      };
    } },
    sloth: { name: 'Sloth', eyeL: [48, 44], eyeR: [72, 44], mouth: [60, 58], neckY: 70, ring: '#FFF4E2', draw(e, m) {
      const fur = '#A48B70', dark = '#7A6450', mask = '#EEDFC6', patch = '#5C4636';
      const claws = (x, y, dir) => `<path d="M${x - 4} ${y} q${dir * 2} 5 ${dir * 5} 4 M${x} ${y + 1} q${dir * 2} 5 ${dir * 5} 4 M${x + 4} ${y} q${dir * 2} 5 ${dir * 5} 4" stroke="#3E2E22" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
      const longArm = (side, x, y, dir) => `<g class="m-arm m-arm-${side}" style="transform-origin:${x}px ${y}px"><ellipse cx="${x}" cy="${y + 13}" rx="6.5" ry="16" fill="${dark}"/>${claws(x, y + 27, dir)}</g>`;
      return {
        back: '',
        body: `<ellipse cx="47" cy="110" rx="9" ry="5" fill="${dark}"/><ellipse cx="73" cy="110" rx="9" ry="5" fill="${dark}"/>
          <ellipse cx="60" cy="89" rx="26" ry="24" fill="${fur}"/><ellipse cx="60" cy="94" rx="15" ry="14" fill="#BBA488"/>
          <path d="M42 80 q4 3 8 0 M70 80 q4 3 8 0 M50 100 q4 3 8 0" stroke="#8C7660" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
        armL: longArm('l', 38, 72, -1), armR: longArm('r', 82, 72, 1),
        head: `<path d="M44 20 q4 -8 9 -2 q4 -9 8 -1 q5 -8 9 2" fill="${fur}"/>
          <circle cx="60" cy="44" r="28" fill="${fur}"/>
          <ellipse cx="60" cy="48" rx="23" ry="19" fill="${mask}"/>
          <path d="M37 40 C 41 36, 51 37, 54 44 C 54 49, 47 52, 42 50 C 38 48, 36 44, 37 40 Z" fill="${patch}"/>
          <path d="M83 40 C 79 36, 69 37, 66 44 C 66 49, 73 52, 78 50 C 82 48, 84 44, 83 40 Z" fill="${patch}"/>
          ${e}<ellipse cx="60" cy="52" rx="4.2" ry="3" fill="#3E2E22"/>
          <circle cx="44" cy="56" r="3.4" class="m-cheek"/><circle cx="76" cy="56" r="3.4" class="m-cheek"/>${m}`
      };
    } },
    macaw: { name: 'Hyacinth macaw', eyeL: [48, 37], eyeR: [72, 37], mouth: [60, 60], neckY: 68, ring: '#FFD43B', draw(e) {
      const blue = '#2C4FBF', wing = '#3B63D6', dark = '#1A1A1E';
      return {
        back: `<path class="m-tail" d="M54 100 C 50 110, 50 118, 54 120 L 60 104 L 66 120 C 70 118, 70 110, 66 100 Z" fill="#23409E"/>`,
        body: `${feet('#4A4A55')}<ellipse cx="60" cy="88" rx="25" ry="25" fill="${blue}"/>
          <path d="M48 80 q12 6 24 0 M50 90 q10 5 20 0" stroke="#4C72E0" stroke-width="2" fill="none" opacity=".7"/>`,
        armL: `<g class="m-arm m-arm-l" style="transform-origin:39px 73px"><path d="M38 72 C 28 80, 30 98, 40 102 C 44 94, 44 82, 38 72 Z" fill="${wing}"/></g>`,
        armR: `<g class="m-arm m-arm-r" style="transform-origin:81px 73px"><path d="M82 72 C 92 80, 90 98, 80 102 C 76 94, 76 82, 82 72 Z" fill="${wing}"/></g>`,
        head: `<path d="M52 20 C 54 12, 60 10, 62 18 C 64 11, 70 12, 68 21" fill="${wing}"/>
          <circle cx="60" cy="42" r="25" fill="${blue}"/>
          ${e}
          <path d="M50 47 C 50 39, 70 39, 70 47 C 70 56, 65 62, 58 65 C 61 59, 60 53, 54 52 Z" fill="${dark}"/>
          <path d="M49 52 C 52 57, 57 57, 61 55 C 59 60, 53 61, 49 57 Z" fill="#FFD43B"/>`
      };
    } }
  };

  // ---- accessories (outfits, props, unlockables), positioned from each kind's anchor points ----
  function accessory(id, k) {
    const [lx, ly] = k.eyeL, [rx, ry] = k.eyeR, n = k.neckY;
    switch (id) {
      case 'labcoat': return `<path d="M36 74 C 40 68, 52 66, 60 70 C 68 66, 80 68, 84 74 L 86 104 C 76 110, 44 110, 34 104 Z" fill="#FAFAFA" stroke="#D0D7DE"/>
        <path d="M52 68 L60 84 L68 68" fill="none" stroke="#C3CBD4" stroke-width="2"/><circle cx="60" cy="92" r="1.5" fill="#9AA5B1"/><circle cx="60" cy="100" r="1.5" fill="#9AA5B1"/>`;
      case 'scrubs': return `<path d="M36 76 C 42 69, 52 68, 60 72 C 68 68, 78 69, 84 76 L 86 104 C 76 110, 44 110, 34 104 Z" fill="#1FA39A"/>
        <path d="M52 70 L60 80 L68 70" fill="none" stroke="#147A73" stroke-width="2.5"/>`;
      case 'stethoscope': return `<path d="M46 ${n} C 44 ${n + 16}, 56 ${n + 20}, 60 ${n + 12} C 64 ${n + 20}, 76 ${n + 16}, 74 ${n}" fill="none" stroke="#3D4B5C" stroke-width="2.6" stroke-linecap="round"/>
        <circle cx="60" cy="${n + 15}" r="4" fill="#9AA5B1" stroke="#3D4B5C" stroke-width="1.5"/>`;
      case 'scarf': return `<path d="M38 ${n - 2} C 50 ${n + 6}, 70 ${n + 6}, 82 ${n - 2} L 82 ${n + 5} C 70 ${n + 13}, 50 ${n + 13}, 38 ${n + 5} Z" fill="#DD0000"/>
        <path d="M38 ${n - 2} C 50 ${n + 6}, 70 ${n + 6}, 82 ${n - 2} L 82 ${n} C 70 ${n + 8}, 50 ${n + 8}, 38 ${n} Z" fill="#111"/>
        <path d="M38 ${n + 3} C 50 ${n + 11}, 70 ${n + 11}, 82 ${n + 3} L 82 ${n + 5} C 70 ${n + 13}, 50 ${n + 13}, 38 ${n + 5} Z" fill="#FFCE00"/>
        <rect x="70" y="${n + 6}" width="8" height="20" rx="2" fill="#DD0000"/><rect x="70" y="${n + 6}" width="8" height="6" fill="#111"/><rect x="70" y="${n + 19}" width="8" height="7" fill="#FFCE00"/>`;
      case 'medal': return `<path d="M52 ${n} L58 ${n + 18} M68 ${n} L62 ${n + 18}" stroke="#1C7ED6" stroke-width="4"/><circle cx="60" cy="${n + 22}" r="6.5" fill="#FFC300" stroke="#C78A00" stroke-width="1.5"/>
        <path d="M60 ${n + 18} l1.5 3 3 .4 -2.2 2 .6 3 -2.9-1.5 -2.9 1.5 .6-3 -2.2-2 3-.4z" fill="#FFF3BF"/>`;
      case 'gradcap': return `<path d="M60 4 L88 14 L60 24 L32 14 Z" fill="#1F2933"/><path d="M44 18 L44 26 C 50 30, 70 30, 76 26 L76 18 L60 24 Z" fill="#323F4B"/>
        <path d="M86 14 L86 28" stroke="#FFC300" stroke-width="2"/><circle cx="86" cy="30" r="2.5" fill="#FFC300"/>`;
      case 'nightcap': return `<path d="M36 26 C 40 8, 70 2, 92 14 C 98 18, 100 26, 100 32 C 92 24, 80 20, 82 24 C 70 18, 50 20, 36 26 Z" fill="#4263EB"/>
        <path d="M34 26 C 50 18, 72 18, 86 26" stroke="#DBE4FF" stroke-width="5" stroke-linecap="round" fill="none"/><circle cx="100" cy="34" r="4.5" fill="#DBE4FF"/>`;
      case 'partyhat': return `<path d="M60 0 L74 24 L46 24 Z" fill="#F06595"/><path d="M53 12 L67 12 M50 18 L70 18" stroke="#FFD43B" stroke-width="2.5"/><circle cx="60" cy="1" r="3" fill="#FFD43B"/>`;
      case 'headband': return `<path d="M33 30 C 45 22, 75 22, 87 30 L 87 35 C 75 27, 45 27, 33 35 Z" fill="#E8590C"/><path d="M85 31 l8 -4 M85 34 l9 2" stroke="#E8590C" stroke-width="3" stroke-linecap="round"/>`;
      case 'goggles': return `<path d="M34 28 C 46 22, 74 22, 86 28" stroke="#495057" stroke-width="3" fill="none"/>
        <circle cx="50" cy="26" r="6" fill="#A5D8FF" stroke="#495057" stroke-width="2.4" opacity=".95"/><circle cx="70" cy="26" r="6" fill="#A5D8FF" stroke="#495057" stroke-width="2.4" opacity=".95"/>`;
      case 'glasses': return `<g fill="none" stroke="#343A40" stroke-width="1.8"><circle cx="${lx}" cy="${ly}" r="6.5"/><circle cx="${rx}" cy="${ry}" r="6.5"/><path d="M${lx + 6.5} ${ly} L${rx - 6.5} ${ry}"/></g>`;
      case 'sunglasses': return `<path d="M${lx - 8} ${ly - 4} L${rx + 8} ${ry - 4}" stroke="#111" stroke-width="2.5"/>
        <path d="M${lx - 8} ${ly - 4} L${lx + 7} ${ly - 4} L${lx + 5} ${ly + 4} Q${lx} ${ly + 7} ${lx - 6} ${ly + 3} Z" fill="#111"/>
        <path d="M${rx - 7} ${ry - 4} L${rx + 8} ${ry - 4} L${rx + 6} ${ry + 3} Q${rx} ${ry + 7} ${rx - 5} ${ry + 4} Z" fill="#111"/>`;
      case 'blanket': return `<path d="M30 78 C 40 66, 80 66, 90 78 L 92 108 C 76 116, 44 116, 28 108 Z" fill="#748FFC"/>
        <path d="M34 86 L86 86 M32 96 L88 96 M30 106 L90 106" stroke="#BAC8FF" stroke-width="2.5" stroke-dasharray="4 4"/>`;
      case 'camera': return `<rect x="45" y="80" width="30" height="20" rx="4" fill="#343A40"/><rect x="51" y="76" width="10" height="5" rx="1.5" fill="#343A40"/>
        <circle cx="60" cy="90" r="6.5" fill="#868E96" stroke="#212529" stroke-width="2"/><circle cx="70" cy="84" r="1.8" fill="#FA5252"/>`;
      case 'book': return `<path d="M42 82 L60 86 L78 82 L78 102 L60 106 L42 102 Z" fill="#FFF"/><path d="M60 86 L60 106" stroke="#CED4DA"/>
        <rect x="42" y="82" width="4" height="20" fill="#111"/><rect x="46" y="82" width="4" height="20" fill="#DD0000"/><rect x="50" y="82" width="4" height="20" fill="#FFCE00"/>`;
      case 'textbook': return `<rect x="44" y="80" width="32" height="24" rx="3" fill="#7048E8"/><rect x="48" y="84" width="24" height="3" fill="#E5DBFF"/>
        <rect x="74" y="74" width="5" height="18" rx="1.5" transform="rotate(25 76 83)" fill="#FAB005"/>`;
      case 'flask': return `<path d="M56 76 L64 76 L64 84 L72 100 C 73 103, 71 105, 68 105 L52 105 C 49 105, 47 103, 48 100 L56 84 Z" fill="#E7F5FF" stroke="#868E96" stroke-width="1.5"/>
        <path d="M50 98 L70 98 L72 101 C 72 103, 70 104, 68 104 L52 104 C 50 104, 48 103, 48 101 Z" fill="#69DB7C"/>`;
      case 'dumbbell': return `<rect x="40" y="84" width="40" height="5" rx="2" fill="#868E96"/><rect x="38" y="78" width="7" height="17" rx="2" fill="#343A40"/><rect x="75" y="78" width="7" height="17" rx="2" fill="#343A40"/>`;
      case 'clipboard': return `<rect x="46" y="76" width="28" height="32" rx="3" fill="#C08B5C"/><rect x="49" y="80" width="22" height="25" rx="1.5" fill="#FFF"/>
        <rect x="54" y="74" width="12" height="5" rx="2" fill="#868E96"/><path d="M52 86 L68 86 M52 91 L68 91 M52 96 L62 96" stroke="#ADB5BD" stroke-width="1.6"/><path d="M52 100 l3 3 5 -6" stroke="#2F9E44" stroke-width="2" fill="none"/>`;
      case 'clapper': return `<rect x="44" y="84" width="32" height="20" rx="2" fill="#212529"/><path d="M44 78 L76 72 L77 78 L45 84 Z" fill="#212529"/>
        <path d="M50 77 L54 82 M58 75.5 L62 80.5 M66 74 L70 79" stroke="#FFF" stroke-width="2.5"/><path d="M48 90 L72 90 M48 96 L66 96" stroke="#FFF" stroke-width="1.2" opacity=".7"/>`;
      case 'torch': return `<path d="M86 66 L100 52" stroke="#FFE066" stroke-width="16" opacity=".35" stroke-linecap="round"/>
        <rect x="80" y="70" width="7" height="16" rx="2" transform="rotate(-40 83 78)" fill="#495057"/><circle cx="88" cy="68" r="3.5" fill="#FFE066"/>`;
      case 'pebble': return `<ellipse cx="60" cy="88" rx="8" ry="6" fill="#ADB5BD" stroke="#868E96" stroke-width="1.5"/><ellipse cx="57.5" cy="86" rx="2.5" ry="1.4" fill="#E9ECEF"/>`;
      case 'water': return `<path d="M-6 100 Q9 94 24 100 T54 100 T84 100 T114 100 T144 100 L144 126 L-6 126 Z" fill="#74C0FC" opacity=".5"/>
        <path d="M-6 107 Q9 101 24 107 T54 107 T84 107 T114 107 T144 107 L144 126 L-6 126 Z" fill="#4DABF7" opacity=".45"/>`;
      default: return '';
    }
  }
  // Layers: 'body' over the body, 'neck' at the throat, 'prop' held in front, 'over' covers arms,
  // 'top' on the head, 'face' over the eyes, 'under' behind everything.
  const LAYER = { labcoat: 'body', scrubs: 'body', blanket: 'over', stethoscope: 'neck', scarf: 'neck', medal: 'neck',
    gradcap: 'top', nightcap: 'top', partyhat: 'top', headband: 'top', goggles: 'top', glasses: 'face', sunglasses: 'face',
    camera: 'prop', book: 'prop', textbook: 'prop', flask: 'prop', dumbbell: 'prop', clipboard: 'prop', clapper: 'prop', torch: 'prop', pebble: 'prop', water: 'front' };

  function svg(kind, { state = 'idle', size = 96, face = false, acc = [], pebbles = 0, cls = '', title = '' } = {}) {
    const k = KINDS[kind] || KINDS.otter;
    const [eyeStyle, mouthStyle] = STYLE[state] || STYLE.idle;
    const accs = [...acc];
    if (state === 'sleepy' && !accs.includes('blanket')) accs.push('blanket');
    if (state === 'night') accs.push('nightcap', 'torch');
    if (state === 'float') accs.push('water');
    const L = { body: '', neck: '', prop: '', over: '', top: '', face: '', front: '' };
    if (!face) accs.forEach(a => { const l = LAYER[a]; if (l) L[l] += accessory(a, k); });
    else accs.forEach(a => { const l = LAYER[a]; if (l === 'top' || l === 'face') L[l] += accessory(a, k); });
    const parts = k.draw(eyes(eyeStyle, k.eyeL, k.eyeR, 4, k.ring), mouth(mouthStyle, k.mouth[0], k.mouth[1]));
    let pouch = '';
    for (let i = 0; i < Math.min(2, pebbles); i++) pouch += `<ellipse cx="${28 + i * 8}" cy="${100 - i * 2}" rx="4.5" ry="3.4" fill="#ADB5BD" stroke="#868E96" stroke-width="1"/>`;
    const extras = state === 'sleepy' ? `<g class="m-zzz"><text x="88" y="24" font-size="11" font-weight="800" fill="#748FFC">z</text><text x="97" y="13" font-size="14" font-weight="800" fill="#748FFC">Z</text></g>`
      : (state === 'celebrate' || state === 'big') ? `<g class="m-spark"><path d="M14 30 l3 -7 3 7 7 3 -7 3 -3 7 -3 -7 -7 -3z" fill="#FFD43B"/><path d="M100 22 l2 -5 2 5 5 2 -5 2 -2 5 -2 -5 -5 -2z" fill="#FF8787"/><circle cx="104" cy="44" r="2.5" fill="#74C0FC"/><circle cx="18" cy="52" r="2" fill="#B197FC"/></g>`
      : state === 'hopeful' ? `<g class="m-heart"><path d="M96 30 c0 -4 6 -4 6 0 c0 -4 6 -4 6 0 c0 4 -6 7 -6 9 c0 -2 -6 -5 -6 -9z" fill="#FF8787"/></g>` : '';
    const vb = face ? '20 4 80 80' : (state === 'float' ? '-6 -6 132 132' : '0 0 120 120');
    return `<svg class="mascot m-${kind} st-${state} ${face ? 'm-face' : ''} ${cls}" viewBox="${vb}" width="${size}" height="${size}" role="img" aria-label="${U.esc(title || k.name)}">
      <g class="m-all">${parts.back}${parts.body}${L.body}${L.neck}${pouch}${L.prop}${parts.armL}${parts.armR}${L.over}<g class="m-head">${parts.head}</g>${L.top}${L.face}</g>${L.front}${extras}</svg>`;
  }

  const AREA_PROPS = { a1: ['dumbbell', 'headband'], a2: ['labcoat', 'goggles', 'flask'], a3: ['scrubs', 'stethoscope'], a4: ['textbook'], a5: ['camera'], a6: ['book'] };
  return { svg, KINDS, AREA_PROPS, kinds: Object.keys(KINDS) };
})();
window.Mascot = Mascot;
