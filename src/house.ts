import { Engine, SpriteSheet, TileMap } from "excalibur";
import { SpriteSheetMap, WFC, WfcConfig } from "./WFC/wfc";

const houseRules: SpriteSheetMap = {
  16: {
    weight: 1,
    up: [16, 17],
    down: [16, 18, 28],
    left: [16, 27],
    right: [16, 27],
  },
  17: {
    weight: 1,
    up: [],
    down: [16, 18, 27, 28],
    left: [17],
    right: [17],
  },
  18: {
    weight: 1,
    up: [16, 17, 27, 28, 18],
    down: [18, 28],
    left: [18, 28],
    right: [18, 28],
  },
  19: {
    weight: 1,
    up: [16, 17, 27, 28, 18],
    down: [],
    left: [18, 28],
    right: [18, 28],
  },
  27: {
    weight: 1,
    up: [16, 17],
    down: [16, 18, 28],
    left: [16, 27],
    right: [16, 27],
  },
  28: {
    weight: 1,
    up: [16, 17, 27, 28, 18],
    down: [18, 28],
    left: [18, 28],
    right: [18, 28],
  },
};

export type HouseConfig = {
  name: string;
  startingPosition?: { x: number; y: number };
  maxWidth: number;
  minWidth: number;
  maxHeight: number;
  minHeight: number;
};

export class House {
  wfc: WFC;
  houseWidth: number;
  houseHeight: number;
  doorIndex: number;
  startingPosition: { x: number; y: number } | undefined;
  houseConfig: HouseConfig;

  constructor(input: HouseConfig) {
    this.houseConfig = input;
    this.houseWidth = this.houseConfig.minWidth + Math.floor(Math.random() * (this.houseConfig.maxWidth - this.houseConfig.minWidth));
    this.houseHeight =
      this.houseConfig.minHeight + Math.floor(Math.random() * (this.houseConfig.maxHeight - this.houseConfig.minHeight));
    this.doorIndex = this.houseWidth * (this.houseHeight - 1) + Math.floor(Math.random() * this.houseWidth);

    const houseWFCoptions: WfcConfig = {
      name: input.name,
      spriteSheetDims: { width: 11, height: 3 },
      tilemapDims: { width: this.houseWidth, height: this.houseHeight },
      auto: true,
      rules: houseRules,
      startingIndex: 1,
    };
    this.wfc = new WFC(houseWFCoptions);
    if (input.startingPosition) this.startingPosition = input.startingPosition;
    this.wfc.initialize();
  }

  async generate() {
    this.wfc.setTile(0, 17);
    this.wfc.setTile(this.doorIndex, 19);
    await this.wfc.generate();
  }

  reset() {
    this.wfc.reset();
    this.wfc.loadRules(houseRules);
    this.houseWidth = this.houseConfig.minWidth + Math.floor(Math.random() * (this.houseConfig.maxWidth - this.houseConfig.minWidth));
    this.houseHeight =
      this.houseConfig.minHeight + Math.floor(Math.random() * (this.houseConfig.maxHeight - this.houseConfig.minHeight));

    this.doorIndex = this.houseWidth * (this.houseHeight - 1) + Math.floor(Math.random() * this.houseWidth);
    this.wfc.setDims({ width: this.houseWidth, height: this.houseHeight });
    this.wfc.initialize();
  }

  setStartingPosition(position: { x: number; y: number }) {
    this.startingPosition = position;
  }

  getStartingPosition() {
    return this.startingPosition;
  }

  getDims() {
    return { width: this.houseWidth, height: this.houseHeight };
  }

  draw(game: Engine, tilemap: TileMap, ss: SpriteSheet) {
    if (!this.startingPosition) return;
    const houseTileIndex = this.startingPosition.y * tilemap.columns + this.startingPosition.x;
    const houseTileIndexes: number[] = [];
    let houseSubTilemapindex: number = 0;

    for (let j = 0; j < this.houseHeight; j++) {
      for (let i = 0; i < this.houseWidth; i++) {
        houseTileIndexes.push((this.startingPosition.y + j) * tilemap.columns + (this.startingPosition.x + i));
      }
    }

    for (let index of houseTileIndexes) {
      let { x, y } = this.wfc.getSpriteCoords(houseSubTilemapindex);
      houseSubTilemapindex++;
      let sprite;

      if (x == -1 && y == -1) continue;
      else sprite = ss.getSprite(x, y);

      if (sprite) {
        if (tilemap.tiles[index].getGraphics()) tilemap.tiles[index].clearGraphics();
        tilemap.tiles[index].addGraphic(sprite);

        if (x == 8 && y == 1) {
          tilemap.tiles[index].data.set("tiletype", "door");
          let doorCoordX = tilemap.tiles[index].x;
          let doorCoordY = tilemap.tiles[index].y;
          //clear out tile under door
          let targetTile = tilemap.tiles.find(t => t.x == doorCoordX && t.y == doorCoordY + 1);
          if (targetTile) targetTile.solid = false;
        } else {
          tilemap.tiles[index].data.set("tiletype", "house");
          tilemap.tiles[index].solid = true;
        }
      }
    }
  }
}
