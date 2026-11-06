(function(root){
  const L={
    view:{W:1672,H:941},
    playerSpawn:[730,720],targetSpawn:[835,532],
    walkPolygon:[[102,622],[302,410],[688,258],[1170,290],[1588,510],[1605,664],[1135,850],[823,881],[303,797]],
    blockers:[
      {id:'left-statue',x:140,y:575,rx:52,ry:27},
      {id:'left-brazier',x:300,y:375,rx:43,ry:25},
      {id:'right-broken-column',x:1438,y:701,rx:57,ry:34},
      {id:'front-left-brazier',x:218,y:799,rx:51,ry:30},
      {id:'front-right-brazier',x:1567,y:699,rx:44,ry:27},
      {id:'rear-right-brazier',x:1635,y:311,rx:41,ry:24}
    ],
    torches:[
      {id:'left',x:299,y:321,r:155,power:.58,seed:1},
      {id:'right-back',x:1644,y:255,r:165,power:.56,seed:3},
      {id:'right-front',x:1567,y:633,r:190,power:.72,seed:5},
      {id:'left-front',x:218,y:728,r:180,power:.68,seed:7},
      {id:'left-low',x:39,y:887,r:130,power:.38,seed:11},
      {id:'wall-left',x:326,y:159,r:67,power:.5,seed:13,scale:.23}
    ],
    occluders:[
      {name:'fg_left_statue',x:54,y:345,w:183,h:250,baseY:590},
      {name:'fg_right_column',x:1368,y:509,w:171,h:233,baseY:720},
      {name:'fg_front_left',x:0,y:651,w:841,h:290,baseY:9999},
      {name:'fg_front_right',x:1110,y:627,w:562,h:314,baseY:9999}
    ]
  };
  root.LEVEL=L;if(typeof module!=='undefined')module.exports=L;
})(typeof window!=='undefined'?window:globalThis);
