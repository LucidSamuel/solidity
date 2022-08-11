from z3 import BitVecVal, Concat, If

def BVUnsignedUpCast(x, n_bits):
	if x.size() > n_bits:
		raise AssertionError
	if x.size() < n_bits:
		return Concat(BitVecVal(0, n_bits - x.size()), x)
	else:
		return x

def BVUnsignedMax(type_bits, n_bits):
	if type_bits > n_bits:
		raise AssertionError
	return BitVecVal((1 << type_bits) - 1, n_bits)

def BVSignedUpCast(x, n_bits):
	if x.size() > n_bits:
		raise AssertionError
	if x.size() < n_bits:
		return Concat(If(x < 0, BitVecVal(-1, n_bits - x.size()), BitVecVal(0, n_bits - x.size())), x)
	else:
		return x

def BVSignedMax(type_bits, n_bits):
	if type_bits > n_bits:
		raise AssertionError
	return BitVecVal((1 << (type_bits - 1)) - 1, n_bits)

def BVSignedMin(type_bits, n_bits):
	if type_bits > n_bits:
		raise AssertionError
	return BitVecVal(-(1 << (type_bits - 1)), n_bits)
