"""Run with python3 -m unittest discover -s integrations/blender-study -p 'test_*.py'."""
import copy
import unittest
from cache_contract import FIELDS, blender_position, node_positions, point_displacement, surface_topology, validate_cache


def fixture():
    grid={'nx':2,'ny':2,'nz':2,'widthM':8,'lengthM':8,'depthM':3.2}
    frame={key:[.1]*8 for key in FIELDS}
    frame.update(timeS=0,displacementM=[0]*81,dryIceKg=4,dryIceTemperatureK=194.65,ledger={'energyResidualJ':0,'massResidualKg':0,'pressureWorkJ':0,'speciesResidualMol':[0]*4})
    return {'format':'zombie-coupled','version':2,'grid':grid,
            'source':{'centerXM':4.4,'centerYM':4,'centerDepthM':1.3,'densityKgM3':1560},
            'runs':{'coupled':{'status':'complete','frames':[frame]}}}


class ContractTests(unittest.TestCase):
    def test_exact_axes_and_displacement_sign(self):
        grid=fixture()['grid']
        p=blender_position(grid,(4.4,4,1.3),(.1,.2,.3))
        for actual,expected in zip(p,(.5,.2,-1.6)):self.assertAlmostEqual(actual,expected)

    def test_external_faces_culled_and_cell_identity_preserved(self):
        data=fixture();grid,_,run=validate_cache(data)
        used,faces,ids=surface_topology(grid,False)
        self.assertEqual(len(faces),24)
        self.assertEqual(set(ids),set(range(8)))
        self.assertEqual(len(used),26)
        self.assertEqual(len(node_positions(grid,run['frames'][0],used)),26)
        _,cutfaces,cutids=surface_topology(grid,True)
        self.assertEqual(len(cutfaces),16)
        self.assertEqual(set(cutids),{2,3,6,7})

    def test_bad_grid_and_truncated_data_rejected(self):
        for change in ('grid','array','nan','mass','status','version','ledger'):
            data=fixture();frame=data['runs']['coupled']['frames'][0]
            if change=='grid':data['grid']['nx']=1.5
            if change=='array':frame['temperatureK'].pop()
            if change=='nan':frame['pressurePa'][0]=float('nan')
            if change=='mass':frame['dryIceKg']=-1
            if change=='status':data['runs']['coupled']['status']='running'
            if change=='version':data['version']=1
            if change=='ledger':frame['ledger']['energyResidualJ']=float('nan')
            with self.subTest(change=change),self.assertRaises(ValueError):validate_cache(data)

    def test_no_repeated_or_reversed_times(self):
        data=fixture();frames=data['runs']['coupled']['frames'];frames.append(copy.deepcopy(frames[0]))
        with self.assertRaises(ValueError):validate_cache(data)
        frames[1]['timeS']=.001;validate_cache(data)

    def test_limited_retains_accepted_history(self):
        data=fixture();data['runs']['coupled']['status']='limited';validate_cache(data)

    def test_display_details_follow_linear_displacement_exactly(self):
        data=fixture();grid,_,run=validate_cache(data);frame=run['frames'][0]
        for z in range(3):
            for y in range(3):
                for x in range(3):
                    q=((z*3+y)*3+x)*3;frame['displacementM'][q:q+3]=[x*.04,y*.08,z*.16]
        value=point_displacement(grid,frame,(1.7,5.3,.7))
        for actual,expected in zip(value,(.017,.106,.07)):self.assertAlmostEqual(actual,expected)


if __name__=='__main__':unittest.main()
