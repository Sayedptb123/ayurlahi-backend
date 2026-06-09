import { Test, TestingModule } from '@nestjs/testing';
import { RetreatController } from './retreat.controller';
import { RetreatService } from './retreat.service';

describe('RetreatController', () => {
  let controller: RetreatController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RetreatController],
      providers: [
        {
          provide: RetreatService,
          useValue: {
            getRooms: jest.fn(),
            createRoom: jest.fn(),
            getPackages: jest.fn(),
            createPackage: jest.fn(),
            getAdmissions: jest.fn(),
            getAdmissionStats: jest.fn(),
            checkIn: jest.fn(),
            discharge: jest.fn(),
            createBooking: jest.fn(),
            getBookings: jest.fn(),
            getBookingById: jest.fn(),
            updateBooking: jest.fn(),
            cancelBooking: jest.fn(),
            checkAvailability: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<RetreatController>(RetreatController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
