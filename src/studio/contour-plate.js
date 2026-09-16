// Closed marching-square contours on a scalar plate with a zero-valued border.
// Integer edge IDs replace per-frame string maps and point-object allocation.
// Connectivity and saddle resolution are shared by Canvas and SVG.
export class ContourPlate {
  draw(ctx, field, w, h, level, width, height) {
    const stride = w + 2, horizontal = (w + 1) * (h + 2);
    const size = horizontal + stride * (h + 1);
    if (this.a?.length !== size) {
      this.a = new Int32Array(size); this.b = new Int32Array(size);
      this.used = new Uint8Array(size); this.nodes = new Int32Array(size);
    }
    const a = this.a, b = this.b, used = this.used, nodes = this.nodes;
    a.fill(-1); b.fill(-1); used.fill(0);
    let count = 0;
    const link = (one, two) => {
      if (a[one] === -1) { a[one] = two; nodes[count++] = one; } else b[one] = two;
      if (a[two] === -1) { a[two] = one; nodes[count++] = two; } else b[two] = one;
    };
    const edges = new Int32Array(4);
    for (let y = 0; y <= h; y++) for (let x = 0; x <= w; x++) {
      const i = y * stride + x;
      const aa = field[i], bb = field[i + 1], cc = field[i + stride + 1], dd = field[i + stride];
      const va = aa >= level, vb = bb >= level, vc = cc >= level, vd = dd >= level;
      let n = 0;
      if (va !== vb) edges[n++] = y * (w + 1) + x;
      if (vb !== vc) edges[n++] = horizontal + y * stride + x + 1;
      if (vc !== vd) edges[n++] = (y + 1) * (w + 1) + x;
      if (vd !== va) edges[n++] = horizontal + y * stride + x;
      if (n === 2) link(edges[0], edges[1]);
      else if (n === 4) {
        if (va === ((aa + bb + cc + dd) / 4 >= level)) {
          link(edges[0], edges[1]); link(edges[2], edges[3]);
        } else { link(edges[0], edges[3]); link(edges[1], edges[2]); }
      }
    }
    const sx = width / w, sy = height / h;
    ctx.beginPath();
    for (let k = 0; k < count; k++) {
      const start = nodes[k];
      if (used[start]) continue;
      let id = start, previous = -1, first = true;
      do {
        used[id] = 1;
        const flat = id < horizontal, edge = flat ? id : id - horizontal;
        const x = edge % (flat ? w + 1 : stride), y = Math.floor(edge / (flat ? w + 1 : stride));
        const i = y * stride + x, next = i + (flat ? 1 : stride);
        const t = (level - field[i]) / (field[next] - field[i]);
        const xx = (x - .5 + (flat ? t : 0)) * sx, yy = (y - .5 + (flat ? 0 : t)) * sy;
        if (first) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
        first = false;
        const neighbor = a[id] === previous ? b[id] : a[id];
        previous = id; id = neighbor;
      } while (id !== -1 && id !== start && !used[id]);
      ctx.closePath();
    }
    ctx.fill("evenodd");
  }
}
