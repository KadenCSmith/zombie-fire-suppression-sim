"""Strict, Blender-independent accepted-checkpoint contract and surface topology.

Coordinates: solver (x east, y north, z depth) -> Blender (x-W/2,y-L/2,-z).
Field values are cell averages, not reconstructed subcell detail.
"""
import math

FIELDS = {
    'temperatureK': ('K', (190, 600)),
    'pressurePa': ('Pa absolute', (100000, 103000)),
    'oxygen': ('mol/mol gas', (0, .21)),
    'co2': ('mol/mol gas', (0, .1)),
    'iceKg': ('kg/cell', (0, 10)),
    'liquidKg': ('kg/cell', (0, 10)),
    'fuelKg': ('kg/cell', (0, 200)),
    'porosity': ('m3/m3 bulk', (.35, .95)),
    'damage': ('dimensionless research damage', (0, 1)),
}


def finite(value, name, minimum=None):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError(f'{name} must be finite numeric data')
    if minimum is not None and value < minimum:
        raise ValueError(f'{name} must be >= {minimum}')
    return value


def validate_cache(data, mode='coupled'):
    if data.get('format') != 'zombie-coupled' or data.get('version') != 2:
        raise ValueError('Export the current zombie-coupled version 2 calculation; legacy exports lack exact grid/source metadata.')
    grid, source = data['grid'], data['source']
    for key in ('nx', 'ny', 'nz'):
        finite(grid[key], key, 1)
        if not isinstance(grid[key],int): raise ValueError(f'{key} must be integer')
    for key in ('widthM', 'lengthM', 'depthM'): finite(grid[key], key, 1e-9)
    for key, extent in [('centerXM', 'widthM'), ('centerYM', 'lengthM'), ('centerDepthM', 'depthM')]:
        finite(source[key], key, 0)
        if source[key] > grid[extent]: raise ValueError(f'{key} outside grid')
    finite(source['densityKgM3'], 'densityKgM3', 1e-9)
    run = data['runs'][mode]
    if run.get('status') not in ('complete', 'limited'):
        raise ValueError('Only finished or validity-limited accepted histories are importable')
    frames = run['frames']
    if not frames: raise ValueError('Accepted history is empty')
    n = grid['nx'] * grid['ny'] * grid['nz']
    nodes = (grid['nx']+1) * (grid['ny']+1) * (grid['nz']+1) * 3
    previous = -1
    for idx, frame in enumerate(frames):
        t = finite(frame['timeS'], f'frames[{idx}].timeS', 0)
        if t <= previous: raise ValueError('Accepted checkpoint times must be strictly increasing')
        previous = t
        for key, count in [(key, n) for key in FIELDS] + [('displacementM', nodes)]:
            values = frame[key]
            if len(values) != count: raise ValueError(f'{key} length must be {count}, got {len(values)}')
            for value in values: finite(value, key)
        finite(frame['dryIceKg'], 'dryIceKg', 0)
        finite(frame['dryIceTemperatureK'], 'dryIceTemperatureK', 0)
        for key in ('energyResidualJ','massResidualKg','pressureWorkJ'):
            finite(frame['ledger'][key], 'ledger.'+key)
        if len(frame['ledger']['speciesResidualMol'])!=4:raise ValueError('Expected four species ledger residuals')
        for value in frame['ledger']['speciesResidualMol']:finite(value,'ledger.speciesResidualMol')
        for key in ('oxygen', 'co2', 'porosity', 'damage'):
            if any(v < -1e-7 or v > 1+1e-7 for v in frame[key]): raise ValueError(f'{key} outside fraction bounds')
        for key in ('iceKg', 'liquidKg', 'fuelKg', 'temperatureK', 'pressurePa'):
            if any(v < 0 for v in frame[key]): raise ValueError(f'{key} contains a negative inventory/state')
        if frame.get('cap'):
            for key in ('centerUpM', 'flexM', 'rimM', 'gapM'): finite(frame['cap'][key], 'cap.'+key)
    return grid, source, run


def blender_position(grid, position, displacement=(0, 0, 0), amplification=1):
    return (position[0]-grid['widthM']/2 + amplification*displacement[0],
            position[1]-grid['lengthM']/2 + amplification*displacement[1],
            -position[2] - amplification*displacement[2])


def surface_topology(grid, cut=True):
    """Only external faces and the cut plane, each carrying its original cell ID.

    Retain the north half y>=floor(ny/2); cut is presentation only. Interior cells
    remain in the embedded unabridged cache and are never aggregated or resampled.
    """
    nx, ny, nz = (grid[k] for k in ('nx', 'ny', 'nz'))
    y0 = ny//2 if cut else 0
    faces, ids = [], []
    node = lambda x,y,z: ((z*(ny+1)+y)*(nx+1)+x)
    for z in range(nz):
        for y in range(y0, ny):
            for x in range(nx):
                corners = [node(x+a,y+b,z+c) for a,b,c in [(0,0,0),(1,0,0),(1,1,0),(0,1,0),(0,0,1),(1,0,1),(1,1,1),(0,1,1)]]
                boundary = [(x==0,(0,4,7,3)),(x==nx-1,(1,2,6,5)),
                            (y==y0,(0,1,5,4)),(y==ny-1,(3,7,6,2)),
                            (z==0,(0,3,2,1)),(z==nz-1,(4,5,6,7))]
                for include, quad in boundary:
                    if include:
                        # Depth-positive -> Z-up reverses orientation.
                        faces.append(tuple(corners[i] for i in reversed(quad)))
                        ids.append((z*ny+y)*nx+x)
    used = sorted({v for face in faces for v in face})
    compact = {original:i for i, original in enumerate(used)}
    return used, [tuple(compact[v] for v in face) for face in faces], ids


def node_positions(grid, frame, used, amplification=1):
    nx, ny = grid['nx'], grid['ny']
    out = []
    for node in used:
        x = node % (nx+1); y = node//(nx+1) % (ny+1); z = node//((nx+1)*(ny+1))
        p = (x*grid['widthM']/nx, y*grid['lengthM']/ny, z*grid['depthM']/grid['nz'])
        out.append(blender_position(grid,p,frame['displacementM'][3*node:3*node+3],amplification))
    return out


def point_displacement(grid, frame, point):
    """Trilinear interpolation of accepted Q1 nodal displacement, without smoothing."""
    counts=[grid[k] for k in ('nx','ny','nz')];extents=[grid[k] for k in ('widthM','lengthM','depthM')]
    cell=[];frac=[]
    for position,count,extent in zip(point,counts,extents):
        q=max(0,min(count,position*count/extent));i=min(count-1,int(q));cell.append(i);frac.append(q-i)
    out=[0,0,0]
    for c in range(2):
        for b in range(2):
            for a in range(2):
                weight=math.prod(frac[i] if offset else 1-frac[i] for i,offset in enumerate((a,b,c)))
                node=(((cell[2]+c)*(counts[1]+1)+cell[1]+b)*(counts[0]+1)+cell[0]+a)*3
                for axis in range(3):out[axis]+=weight*frame['displacementM'][node+axis]
    return out
