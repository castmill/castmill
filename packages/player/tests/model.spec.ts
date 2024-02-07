import { expect } from 'chai'
import { describe, it } from 'mocha'
import { Model } from '../src/widgets/template/data/model' // Adjust this import based on your actual file structure

describe('Model.get method', () => {
  it('should get value from simple keypath', () => {
    const obj = { foo: { bar: 'baz' } }
    const [result, error] = Model.get(obj, 'foo.bar')
    expect(error).to.be.undefined
    expect(result).to.equal('baz')
  })

  it('should get value from array using numeric index', () => {
    const obj = { foo: { arr: [1, 2, 3] } }
    const [result, error] = Model.get(obj, 'foo.arr[2]')
    expect(error).to.be.undefined
    expect(result).to.equal(3)
  })

  it('should get subarray using slice notation', () => {
    const obj = { foo: { arr: [1, 2, 3, 4, 5] } }
    const [result, error] = Model.get(obj, 'foo.arr[1:4]')
    expect(error).to.be.undefined
    expect(result).to.eql([2, 3, 4])
  })

  it('should use global for array index', () => {
    const obj = { foo: { arr: [1, 2, 3] } }
    const globals = { index: 2 }
    const [result, error] = Model.get(obj, 'foo.arr[@index]', globals)
    expect(error).to.be.undefined
    expect(result).to.equal(3)
  })

  it('should return error for invalid keypath', () => {
    const obj = { foo: { bar: 'baz' } }
    const [result, error] = Model.get(obj, 'foo.invalid')
    expect(error).to.not.be.undefined
    expect(result).to.be.undefined
  })

  it('should return error for non-array when expecting an array', () => {
    const obj = { foo: { bar: 'not-an-array' } }
    const [result, error] = Model.get(obj, 'foo.bar[1]')
    expect(error).to.not.be.undefined
    expect(result).to.be.undefined
  })

  it('should return error for non-existing global key', () => {
    const obj = { foo: { arr: [1, 2, 3] } }
    const [result, error] = Model.get(obj, 'foo.arr[@missing]')
    expect(error).to.not.be.undefined
    expect(result).to.be.undefined
  })

  it('should return a nested value', () => {
    const data = { foo: { bar: 'baz' } }
    const [result] = Model.get(data, 'foo.bar')
    expect(result).to.equal('baz')
  })

  it('should return a value in an array', () => {
    const data = { foo: { arr: [0, 1, 2, 3] } }
    const [result] = Model.get(data, 'foo.arr[2]')
    expect(result).to.equal(2)
  })

  it('should return a subarray', () => {
    const data = { foo: { arr: [0, 1, 2, 3] } }
    const [result] = Model.get(data, 'foo.arr[1:3]')
    expect(result).to.deep.equal([1, 2])
  })

  it('should use global for array index', () => {
    const data = { foo: { arr: [0, 1, 2, 3] } }
    const [result] = Model.get(data, 'foo.arr[@index]', { index: 3 })
    expect(result).to.equal(3)
  })

  it('should use global for object index', () => {
    const data = { foo: { obj: { bax: 'qux' } } }
    const [result] = Model.get(data, 'foo.obj[@index]', { index: 'bax' })
    expect(result).to.equal('qux')
  })

  it('should throw error for invalid keypath', () => {
    const data = { foo: { arr: [0, 1, 2, 3] } }
    const [result, error] = Model.get(data, 'foo.invalid[0]')
    expect(result).to.be.undefined
    expect(error).to.be.instanceOf(Error)
  })

  it('should throw error for invalid array index', () => {
    const data = { foo: { arr: [0, 1, 2, 3] } }
    const [result, error] = Model.get(data, 'foo.arr[100]')
    expect(result).to.be.undefined
    expect(error).to.be.instanceOf(Error)
  })

  it('should return undefined for missing global index', () => {
    const data = { foo: { arr: [0, 1, 2, 3] } }
    const [result, error] = Model.get(data, 'foo.arr[@missing]')
    expect(result).to.be.undefined
    expect(error).to.be.instanceOf(Error)
  })

  it('should handle multiple nested globals', () => {
    const data = { foo: { arr: [{ nested: ['zero', 'one', 'two'] }] } }
    const [result] = Model.get(data, 'foo.arr[@index1].nested[@index2]', {
      index1: 0,
      index2: 2,
    })
    expect(result).to.equal('two')
  })
})
