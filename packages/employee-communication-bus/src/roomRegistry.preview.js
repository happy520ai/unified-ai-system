import { createEmployeeRoom, validateEmployeeRoom } from "../../employee-communication-contracts/src/index.js";

export function createRoomRegistryPreview() {
  const rooms = [createEmployeeRoom()];
  return {
    listRooms() {
      return [...rooms];
    },
    getRoom(roomId) {
      return rooms.find((room) => room.roomId === roomId) || null;
    },
    validateRooms() {
      return rooms.every((room) => validateEmployeeRoom(room).valid);
    },
  };
}
