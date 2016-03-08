var REMOTEURL='http://192.168.1.34:8081';

/*
 * Send and fetch game state to a remote memory storage.
 */
var Remote={
    client:-1, //TODO #init
    game:-1,//TODO #init
    summoned:[],//creatures summoned on remote turn
    downloaded:false,//downloaded packet
    step:0,//number of remote moves so far
    
    /*
     * If necessary, waits for a remote player to act then update game state.
     * Returns false if doesn't have to defer to another player.
     */
    defer:function(){
        if(!G.queue[0])return false;
        if(this.init){
            this.init();
            this.init=false;
        }
        if (this.step==0&&this.client!=0) {
            this.wait();
            this.download();
        } else if(G.queue[0].team!=this.client) this.send();
        else return false;
        return true;
    },
    
    //TODO hack for determining who we are
    init:function(){
        var d=new Date();
        var now=d.getFullYear() +
               paddate(d.getMonth() + 1) + 
               paddate(d.getDate()) +
               paddate(d.getHours()) +
               paddate(d.getMinutes()) +
               paddate(d.getSeconds());
        this.client=parseInt(window.prompt("Which player are you going to be?", "1"))-1;
        this.game=parseInt(window.prompt("Which game id do you want to join?", now));
    },
    
    /*
     * Uploads current game state.
     */
    send:function(){
        //console.debug(G.nextQueue);
        
        var packet={};
        packet.game=this.game;
        this.step+=1;
        packet.step=this.step;
        packet.creatures=[];
        for(var i=0;i<G.creatures.length;i++){
            var c=jQuery.extend(true, {}, G.creatures[i]);
            for (var prop in c) if (c.hasOwnProperty(prop)&&c[prop] instanceof Function) delete c[prop];
            packet.creatures.push(filter(c));
            //debugcreature(c);
        }
        packet.turn=G.turn;
        packet.ids=G.creaIdCounter;
        packet.queue=queuetoid(G.queue);
        packet.delayQueue=queuetoid(G.delayQueue);
        packet.nextQueue=queuetoid(G.nextQueue);
        
        packet=JSON.stringify(packet);
        console.debug(packet);
        $j.post( REMOTEURL,packet, function( data ) {
            Remote.wait();
            Remote.download();
        });
    },
    
    /*
     * TODO in the future use a new API call
     * to wait until the other move is done
     * 
     * currently does nothing
     */
    wait:function(){
        $j('#waiting').css('display','block');
    },
    
    /*
     * Gets the remote game state.
     */
    download:function(){
        $j.get(REMOTEURL+'?game='+Remote.game,function( data ) {
            packet=data;
            //console.debug('step:'+packet.step);
            if(packet.step==Remote.step){
                $j('#waiting').append('.');
                setTimeout(Remote.download,3000);
                return;
            }
            $j('#waiting').css('display','none');
            Remote.downloaded=packet;
            var packet=Remote.downloaded;
            Remote.game=packet.game;
            Remote.summoned=[];
            Remote.step=packet.step;
            packetcreature:for(var i=0;i<packet.creatures.length;i++){
                var sent=packet.creatures[i];
                console.debug('loop '+j);//TODO
                console.debug(G.creatures);
                for(var j=0;j<G.creatures.length;j++){
                    var c=G.creatures[j];
                    if(!c||sent.id!=c.id){
                        continue;
                    }
                    c.lastpos={x:c.x,y:c.y};
                    for (var prop in sent) if (sent.hasOwnProperty(prop)) c[prop]=sent[prop];
                    continue packetcreature;
                }
                console.debug('summoned #'+sent.id);//TODO
                Remote.summoned.push(packet.creatures[i]);
            }
            G.creaIdCounter=packet.ids;
            G.queue=idtoqueue(packet.queue);
            G.delayQueue=idtoqueue(packet.delayQueue);
            G.nextQueue=idtoqueue(packet.nextQueue);
            Remote.update();
        });
    },
    
    /*
     * 
     */
    update:function(){
        //TODO add summoned creatures
        //TODO remove dead creatures
        //TODO move creatures
        
        G.grid.forEachHexs(function(){this.creature=undefined;});
        for(var i=0;i<G.creatures.length;i++){
            var c=G.creatures[i];
            if(!c)continue;
            //c.updateHex();
            for(var j=0;j<Remote.downloaded.creatures.length;j++){
                var sent=Remote.downloaded.creatures[j];
                if(!sent||sent.id!=c.id){
                    continue;
                }
                console.debug('testing pos '+JSON.stringify(c.pos));//TODO
                if(c.pos.x!=c.lastpos.x||c.pos.y!=c.lastpos.y){
                    var hex=G.grid.hexs[c.pos.y][c.pos.x];
                    //var hex=c.hexagons[0];
                    c.moveTo(hex,{animation:'teleport',ignorePath:true,});
                }
            }
        }
        
        if(Remote.downloaded.turn>G.turn){
            console.debug('next');
            G.nextRound();
        } else G.nextCreature();//resume
    },
}

function paddate(n) {  // always returns a string
    return (n < 10 ? '0' : '') + n;
}

function queuetoid(q){
    var ids=[];
    for(var i=0;i<=q.length;i++){
        ids.push(q[i]?q[i].id:undefined);
    }
    return ids;
}

function idtoqueue(ids){
    var queue=[];
    for(var i=0;i<ids.length;i++){
        for(var j=0;j<G.creatures.length;j++){
            if(G.creatures[j]&&G.creatures[j].id==ids[i]){
                queue.push(G.creatures[j]);
                break;
            }
        }
    }
    return queue;
}

//TODO remove
function debugcreature(c){
    var properties='';
    for (var prop in c) if (c.hasOwnProperty(prop)) console.debug(prop+'='+c[prop]);
    console.debug('pos='+JSON.stringify(c['pos']))
}

function filter(c){
    delete c['abilities'];
    delete c['grp'];
    delete c['sprite'];
    delete c['hintGrp'];
    delete c['healtIndicatorGrp'];
    delete c['healtIndicatorSprite'];
    delete c['healtIndicatorText'];
    delete c['baseStats'];
    delete c['stats']; //TODO
    delete c['animation'];
    delete c['display'];
    delete c['hexagons'];
    delete c['player'];
    delete c['x'];
    delete c['y'];
    return c;
}