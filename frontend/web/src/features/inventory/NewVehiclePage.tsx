import { useNavigate } from 'react-router'
import { createVehicle } from './api'
import { goToInventory } from './inventoryRoutes'
import VehicleForm from './VehicleForm'
import VehicleFormPage from './VehicleFormPage'
import { emptyValues } from './vehicleFields'

// Load a vehicle (Figma 38:923, CU-19): the form starts empty; saving returns to the list with a success message.
export default function NewVehiclePage() {
  const navigate = useNavigate()

  return (
    <VehicleFormPage title="Cargar vehículo" subtitle="La patente debe ser única en toda la plataforma. Subí al menos 7 fotos del vehículo.">
      <VehicleForm
        initialValues={emptyValues()}
        initialPhotos={[]}
        submitLabel="GUARDAR VEHÍCULO"
        onSubmit={async (submission) => {
          await createVehicle(submission)
          goToInventory(navigate, 'Cargaste el vehículo.')
        }}
      />
    </VehicleFormPage>
  )
}
