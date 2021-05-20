class e{constructor(e){this.M=null,this.P=null,this.T=e}type(t){return new e(t)}payload(){return new e(this.T)}message(e){return this.T===e.type}build(e){return e}}const t=new e("");t.type("echo").payload(),t.type("session.created").payload(),t.type("session.closed").payload();const s=()=>"hi";t.type("horse");export{s as hello};
//# sourceMappingURL=gnop.modern.js.map
