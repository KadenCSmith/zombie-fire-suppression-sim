// Shared numerical kernel: y = sum_e K_e x with fixed DOFs eliminated.
// All arithmetic is IEEE float64. No fast-math or reduced precision.
void brick(int count,int size,const int *dofs,const int *material,const double *blocks,const double *scales,const unsigned char *fixed,const double *x,double *y){
 for(int i=0;i<size;i++)y[i]=0;
 for(int e=0;e<count;e++)for(int a=0;a<24;a++){
  int ga=dofs[e*24+a];if(fixed[ga])continue;double value=0;const double *row=blocks+material[e]*576+a*24;
  for(int b=0;b<24;b++){int gb=dofs[e*24+b];if(!fixed[gb])value+=row[b]*x[gb];}y[ga]+=scales[e]*value;
 }
 for(int i=0;i<size;i++)if(fixed[i])y[i]=x[i];
}
