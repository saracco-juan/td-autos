import { StyleSheet, Text, View } from 'react-native'

export default function Home() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>TD Autos</Text>
      <Text>Estamos preparando la app.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
})
