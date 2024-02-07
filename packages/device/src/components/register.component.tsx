import { Device } from '../classes'
import { PincodeComponent } from './pincode.component'

export function RegisterComponent(props: { device: Device; pincode: string }) {
  return (
    <>
      <h1>Register</h1>
      <PincodeComponent pincode={props.pincode} />
    </>
  )
}
