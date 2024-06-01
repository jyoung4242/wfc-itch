import { Engine, SpriteSheet, TileMap } from "excalibur";
import { SpriteSheetMap, WFC, WfcConfig } from "./WFC/wfc";

const mapRules: SpriteSheetMap = {
  0: {
    weight: 1,
    up: [0, 1, 4],
    down: [0, 4],
    left: [0, 1, 4],
    right: [0, 1, 4],
  },
  1: {
    weight: 1,
    up: [1, 4],
    down: [0, 1],
    left: [0, 1, 4],
    right: [0, 1, 4],
  },

  4: {
    weight: 1,
    up: [0, 4],
    down: [0, 1, 4],
    left: [0, 1, 4],
    right: [0, 1, 4],
  },
};

export class MapGen {
  wfc: WFC;
  mapWidth: number;
  mapHeight: number;
  treeDensity: number;
  constructor(params: { treedensity: number; mapWidth: number; mapHeight: number }) {
    this.mapWidth = params.mapWidth;
    this.mapHeight = params.mapHeight;
    this.treeDensity = params.treedensity;
    if (params.treedensity < 0) mapRules[4].weight = Math.abs(params.treedensity);
    else if (params.treedensity > 0) mapRules[0].weight = params.treedensity;

    const wfcOptions: WfcConfig = {
      name: "map",
      spriteSheetDims: { width: 11, height: 3 },
      tilemapDims: { width: params.mapWidth, height: params.mapHeight },
      auto: true,
      rules: mapRules,
    };
    this.wfc = new WFC(wfcOptions);
    this.wfc.initialize();
  }

  async generate() {
    await this.wfc.generate();
  }

  reset() {
    this.wfc.reset();
    this.wfc.loadRules(mapRules);
    this.wfc.initialize();
  }

  draw(game: Engine, tilemap: TileMap, ss: SpriteSheet) {
    let tileIndex = 0;
    for (let tile of tilemap.tiles) {
      let { x, y } = this.wfc.getSpriteCoords(tileIndex);
      let sprite;
      if (x == -1 && y == -1) continue;
      else sprite = ss.getSprite(x, y);

      if (sprite) {
        if (tile.getGraphics()) tile.clearGraphics();
        tile.addGraphic(sprite);
        if (x == 0 && y == 0) {
          tile.data.set("tiletype", "tree");
          tile.solid = true;
        } else if (x == 1 && y == 0) {
          tile.data.set("tiletype", "tree");
          tile.solid = false;
        } else {
          tile.data.set("tiletype", "grass");
          tile.solid = false;
        }
      }
      tileIndex++;
    }
  }
}
