#include <cstdio>
#include <vector>
#include <chrono>
#include "brick.c"
template<class T>void read(std::vector<T>&a){if(fread(a.data(),sizeof(T),a.size(),stdin)!=a.size())std::exit(2);}
int main(){int h[4];if(fread(h,4,4,stdin)!=4)return 2;int n=h[0],size=h[1],mat=h[2],repeat=h[3];std::vector<int>dofs(n*24),material(n);std::vector<double>blocks(mat*576),scales(n),x(size),y(size);std::vector<unsigned char>fixed(size);read(dofs);read(material);read(blocks);read(scales);read(fixed);read(x);for(int i=0;i<10;i++)brick(n,size,dofs.data(),material.data(),blocks.data(),scales.data(),fixed.data(),x.data(),y.data());auto start=std::chrono::steady_clock::now();for(int i=0;i<repeat;i++)brick(n,size,dofs.data(),material.data(),blocks.data(),scales.data(),fixed.data(),x.data(),y.data());double ms=std::chrono::duration<double,std::milli>(std::chrono::steady_clock::now()-start).count();fwrite(&ms,8,1,stdout);fwrite(y.data(),8,size,stdout);}
