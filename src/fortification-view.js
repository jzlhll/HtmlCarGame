import * as THREE from 'three';
import { material } from './models.js';

const box=new THREE.BoxGeometry(1,1,1),tube=new THREE.CylinderGeometry(1,1,1,10).rotateX(Math.PI/2);

// 双侧防御建筑按种类复用，炮口始终朝向玩家，射弹仍锁定发射瞬间的方向。
export class FortificationView {
  constructor(scene){this.scene=scene;this.views=new Map();this.pools={bunker:[],tower:[]};}
  create(kind){
    const root=new THREE.Group(),gun=new THREE.Group();
    const add=(parent,color,size,position,geometry=box)=>{const mesh=new THREE.Mesh(geometry,material(color));mesh.scale.set(...size);mesh.position.set(...position);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;};
    add(root,0x5a626a,[6,.4,6],[0,.2,0]);
    const support=add(root,0x65757e,[3,1,3],[0,-.5,0]);support.visible=false;
    if(kind==='bunker'){
      add(root,0x82918c,[5,1.8,4.6],[0,1.1,0]);
      add(root,0xb1b9a6,[5.6,.5,5.2],[0,2.25,0]);
      for(const side of [-1,1])add(root,0x1f353d,[.08,.45,2.6],[side*2.52,1.4,0]);
      gun.position.y=3.1;
      add(gun,0x34464d,[1.6,.65,1.8],[0,0,0]);
      for(const side of [-1,1]){
        add(gun,0x667e78,[.28,.28,2.8],[side*.48,0,-1.4],tube);
        add(gun,0x18242e,[.31,.31,.15],[side*.48,0,-2.8],tube);
      }
    }else{
      add(root,0xb4ab91,[2.6,4.3,2.6],[0,2.55,0]);
      add(root,0x485d69,[4.2,1,4.2],[0,4.7,0]);
      for(const side of [-1,1])for(const end of [-1,1])add(root,0xd7c390,[.65,.8,.65],[side*1.8,5.1,end*1.8]);
      add(root,0x22313c,[.08,1.4,1],[1.32,3.1,0]);
      gun.position.y=5.4;
      add(gun,0x648ca0,[1.5,.65,1.5],[0,0,0]);
      add(gun,0x22313c,[.17,.17,2.8],[0,0,-1.4],tube);
    }
    root.add(gun);root.userData={kind,gun,support};return root;
  }
  reset(){for(const [id,view]of this.views){this.scene.remove(view);this.pools[view.userData.kind].push(view);this.views.delete(id);}}
  draw(renderer,game){
    const ids=new Set(game.combat.buildings.map(building=>building.id));
    for(const [id,view]of this.views)if(!ids.has(id)){this.scene.remove(view);this.pools[view.userData.kind].push(view);this.views.delete(id);}
    const target=renderer.local(game.player.s,game.player.d,game.player.route);
    for(const building of game.combat.buildings){
      let view=this.views.get(building.id);
      if(!view){view=this.pools[building.kind].pop()||this.create(building.kind);this.views.set(building.id,view);this.scene.add(view);}
      const p=renderer.local(building.s,building.d);
      const height=renderer.road.at(building.s).y-renderer.road.groundElevation(building.s);
      view.userData.support.visible=height>0;
      if(height>0){view.userData.support.scale.y=height;view.userData.support.position.y=-height/2;}
      view.position.set(p.x,p.y,p.z);view.rotation.set(0,-p.heading,0);view.updateMatrixWorld(true);
      view.userData.gun.lookAt(target.x,target.y+.8,target.z);view.userData.gun.rotateY(Math.PI);
    }
  }
}
