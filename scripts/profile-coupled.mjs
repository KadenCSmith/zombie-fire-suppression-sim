import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{const {CoupledEngine}=await server.ssrLoadModule('/src/coupled/engine.ts'),{DEFAULT_COUPLED}=await server.ssrLoadModule('/src/coupled/model.ts');
for(const fidelity of ['preview','engineering']){const a=performance.now(),engine=new CoupledEngine({...DEFAULT_COUPLED,fidelity}),b=performance.now();engine.advance(10);console.log({fidelity,setupMs:b-a,solveMs:performance.now()-b,iterations:engine.couplingIterations,energyJ:engine.mechanicalBalanceJ,thermal:engine.transport.ledger,mechanical:engine.frame().mechanical})}}
finally{await server.close()}
