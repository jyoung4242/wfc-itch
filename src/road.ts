import { ExcaliburAStar, GraphNode, aStarNode } from "@excaliburjs/plugin-pathfinding";
import { Engine, SpriteSheet, TileMap } from "excalibur";

export class Road {
  graph: ExcaliburAStar;
  startingnode: aStarNode;
  endingnode: aStarNode;
  path: GraphNode[];
  constructor(tilemap: TileMap, startingCoords: { x: number; y: number }, endingCoords: { x: number; y: number }) {
    this.graph = new ExcaliburAStar(tilemap);
    this.startingnode = this.graph.getNodeByCoord(startingCoords.x, startingCoords.y);
    this.endingnode = this.graph.getNodeByCoord(endingCoords.x, endingCoords.y);
    this.path = this.graph.astar(this.startingnode, this.endingnode, false);
    console.log(this.startingnode);

    console.log(this.path);
    this.path.unshift(this.startingnode);
  }

  reset() {}

  draw(game: Engine, tilemap: TileMap, ss: SpriteSheet) {
    if (this.path.length == 0) return;
    let width = tilemap.columns;
    this.path.forEach(node => {
      let x = (node.id as number) % width;
      let y = Math.floor((node.id as number) / width);
      //get tile
      let targetTile = tilemap.tiles.find(t => t.x == x && t.y == y);
      if (!targetTile) return;

      const sprite = ss.getSprite(3, 0);
      if (sprite) {
        targetTile.clearGraphics();
        targetTile.addGraphic(sprite);
        targetTile.solid = false;
        targetTile.data.set("tiletype", "road");
      }
    });
  }
}
