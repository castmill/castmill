export function PincodeComponent(props: { pincode: string }) {
  return (
    <div>
      <div>
        <h1>Pincode:</h1>
      </div>
      <div>{props.pincode ? props.pincode : "Loading pincode..."}</div>
    </div>
  );
}
